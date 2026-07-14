"""Training entry point (CONTRACTS.md §6.2).

``train_and_register(dataset_path, model_dir, experiment_name)`` runs the full
training pipeline:

1. Load the CSV, validate it (:mod:`ml.data.validation`), then clean it
   (:mod:`ml.data.cleaning`).
2. Add engineered features and do a stratified 80/20 train/test split.
3. Fit three candidate pipelines (each wraps a ``StandardScaler``):
   ``LogisticRegression``, ``RandomForestClassifier``, ``XGBClassifier``.
4. Evaluate each (:mod:`ml.training.evaluate`) and select the best by ROC-AUC.
5. Log every candidate to MLflow — fully wrapped in ``try/except`` so a missing
   or unreachable tracking server never fails training.
6. Register the winner via :mod:`ml.training.registry` (versioned joblib +
   ``metadata.json`` + drift ``reference.csv``) and auto-activate it.
7. Return a summary dict.

Hyperparameters are read from the flat repo-root ``params.yaml`` when present
via :func:`ml.config.load_params` (a tiny hand parser — no PyYAML dependency),
falling back to :data:`ml.config.DEFAULT_PARAMS`.

CLI::

    python -m ml.training.train --dataset <csv> --model-dir <dir>
"""

from __future__ import annotations

import argparse
from typing import Any

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from ml import config
from ml.data.cleaning import clean_dataframe
from ml.data.validation import validate_dataframe
from ml.features.engineering import (
    MODEL_COLUMNS,
    TARGET_COLUMN,
    add_engineered_features,
)
from ml.training.evaluate import evaluate_model
from ml.training.registry import register_model


def _build_candidates(params: dict[str, Any]) -> dict[str, Pipeline]:
    """Construct the three candidate pipelines from resolved hyperparameters."""
    random_state = int(params.get("random_state", 42))

    logreg = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "model",
                LogisticRegression(
                    max_iter=int(params.get("logreg_max_iter", 1000)),
                    random_state=random_state,
                ),
            ),
        ]
    )

    rf = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=int(params.get("rf_n_estimators", 300)),
                    random_state=random_state,
                ),
            ),
        ]
    )

    xgb = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "model",
                XGBClassifier(
                    n_estimators=int(params.get("xgb_n_estimators", 300)),
                    learning_rate=float(params.get("xgb_learning_rate", 0.1)),
                    max_depth=int(params.get("xgb_max_depth", 5)),
                    eval_metric="logloss",
                    random_state=random_state,
                ),
            ),
        ]
    )

    return {
        "LogisticRegression": logreg,
        "RandomForest": rf,
        "XGBoost": xgb,
    }


def _log_candidate_to_mlflow(
    experiment_name: str,
    candidate_name: str,
    params: dict[str, Any],
    metrics: dict[str, Any],
    pipeline: Pipeline,
    is_best: bool,
) -> str | None:
    """Log one candidate run to MLflow. Never raises — returns run id or ``None``.

    All MLflow interaction is guarded so training succeeds even when MLflow is
    not installed, ``MLFLOW_TRACKING_URI`` is empty/unreachable, or logging the
    model artifact fails.
    """
    try:
        import mlflow
        import mlflow.sklearn

        tracking_uri = config.get_mlflow_tracking_uri()
        if tracking_uri:
            mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)

        run_id: str | None = None
        with mlflow.start_run(run_name=candidate_name) as run:
            run_id = run.info.run_id
            mlflow.set_tag("candidate", candidate_name)
            mlflow.set_tag("is_best", str(is_best).lower())
            # Log the flat hyperparameters plus the model type.
            loggable_params = {
                k: v for k, v in params.items() if isinstance(v, (int, float, str, bool))
            }
            loggable_params["model_type"] = candidate_name
            mlflow.log_params(loggable_params)
            scalar_metrics = {
                k: float(v)
                for k, v in metrics.items()
                if isinstance(v, (int, float))
            }
            mlflow.log_metrics(scalar_metrics)
            try:
                mlflow.sklearn.log_model(pipeline, name="model")
            except Exception:  # noqa: BLE001 - artifact logging is best-effort
                pass
        return run_id
    except Exception:  # noqa: BLE001 - MLflow is entirely optional
        return None


def train_and_register(
    dataset_path: str,
    model_dir: str,
    experiment_name: str = "vaniai-placement",
) -> dict[str, Any]:
    """Run the full training pipeline and register the best model.

    Returns ``{"version", "model_type", "metrics", "candidates", "mlflow_run_id"}``.
    Raises ``ValueError`` if the dataset fails validation.
    """
    params = config.load_params()

    raw = pd.read_csv(dataset_path)

    ok, errors = validate_dataframe(raw)
    if not ok:
        raise ValueError(
            "Dataset validation failed for "
            f"'{dataset_path}':\n- " + "\n- ".join(errors)
        )

    cleaned = clean_dataframe(raw)

    engineered = add_engineered_features(cleaned)
    X = engineered[MODEL_COLUMNS]
    y = engineered[TARGET_COLUMN].astype(int)

    test_size = float(params.get("test_size", 0.2))
    random_state = int(params.get("random_state", 42))

    # Stratify by target so both classes appear in train and test.
    stratify = y if y.nunique() > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    candidates = _build_candidates(params)
    candidate_metrics: dict[str, dict[str, Any]] = {}
    fitted: dict[str, Pipeline] = {}

    for name, pipeline in candidates.items():
        pipeline.fit(X_train, y_train)
        metrics = evaluate_model(pipeline, X_test, y_test)
        candidate_metrics[name] = metrics
        fitted[name] = pipeline

    # Select best by roc_auc (tie-break on f1 then accuracy).
    best_name = max(
        candidate_metrics,
        key=lambda n: (
            candidate_metrics[n]["roc_auc"],
            candidate_metrics[n]["f1"],
            candidate_metrics[n]["accuracy"],
        ),
    )
    best_pipeline = fitted[best_name]
    best_metrics = candidate_metrics[best_name]

    # Log every candidate to MLflow (best-effort). Capture the best run id.
    best_run_id: str | None = None
    for name in candidates:
        run_id = _log_candidate_to_mlflow(
            experiment_name=experiment_name,
            candidate_name=name,
            params=params,
            metrics=candidate_metrics[name],
            pipeline=fitted[name],
            is_best=(name == best_name),
        )
        if name == best_name:
            best_run_id = run_id

    metadata = register_model(
        pipeline=best_pipeline,
        metrics=best_metrics,
        model_type=best_name,
        model_dir=model_dir,
        dataset_path=dataset_path,
        reference_df=cleaned,
        feature_columns=list(MODEL_COLUMNS),
        activate=True,
    )

    return {
        "version": metadata["version"],
        "model_type": best_name,
        "metrics": best_metrics,
        "candidates": candidate_metrics,
        "mlflow_run_id": best_run_id,
    }


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m ml.training.train",
        description="Train placement candidates and register the best model.",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(config.get_default_dataset_path()),
        help="Path to the training CSV.",
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        default=str(config.get_model_dir()),
        help="Directory for the versioned model registry (default: MODEL_DIR).",
    )
    parser.add_argument(
        "--experiment-name",
        type=str,
        default=config.EXPERIMENT_NAME,
        help="MLflow experiment name (default: vaniai-placement).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns a process exit code."""
    args = _build_arg_parser().parse_args(argv)
    result = train_and_register(
        dataset_path=args.dataset,
        model_dir=args.model_dir,
        experiment_name=args.experiment_name,
    )
    metrics = result["metrics"]
    print(
        f"Registered {result['version']} "
        f"({result['model_type']}) "
        f"roc_auc={metrics['roc_auc']:.4f} "
        f"accuracy={metrics['accuracy']:.4f} "
        f"f1={metrics['f1']:.4f}"
    )
    if result["mlflow_run_id"]:
        print(f"MLflow run: {result['mlflow_run_id']}")
    else:
        print("MLflow logging skipped or unavailable (training unaffected).")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
