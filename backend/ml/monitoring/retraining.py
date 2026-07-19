"""Retraining policy and trigger (CONTRACTS.md §6.6).

- ``should_retrain(drift_result, prediction_drift, min_new_rows, new_rows)`` ->
  ``(bool, reason)`` deciding whether a retrain is warranted.
- ``trigger_retraining(dataset_path, model_dir)`` -> delegates to
  ``ml.training.train.train_and_register`` and returns its result dict.

Runnable as a module for the scheduled CI job::

    python -m ml.monitoring.retraining --dataset ../data/sample_students.csv
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from ml import config
from ml.training.train import train_and_register

# A data-drift share at or above this fraction of features is significant.
_DRIFT_SHARE_THRESHOLD = 0.3
# A prediction-drift PSI above this indicates a meaningful distribution shift.
_PSI_THRESHOLD = 0.2


def should_retrain(
    drift_result: dict[str, Any] | None,
    prediction_drift: dict[str, Any] | None,
    min_new_rows: int,
    new_rows: int,
) -> tuple[bool, str]:
    """Decide whether retraining is warranted and explain why."""
    reasons: list[str] = []

    if drift_result:
        share = float(drift_result.get("share_drifted", 0.0))
        if drift_result.get("data_drift_detected") or share >= _DRIFT_SHARE_THRESHOLD:
            reasons.append(
                f"data drift detected ({share * 100:.0f}% of features shifted)"
            )

    if prediction_drift:
        psi = float(prediction_drift.get("psi", 0.0))
        if prediction_drift.get("drift_detected") or psi > _PSI_THRESHOLD:
            reasons.append(f"prediction drift detected (PSI={psi:.3f})")

    if min_new_rows > 0 and new_rows >= min_new_rows:
        reasons.append(f"{new_rows} new labeled rows available (>= {min_new_rows})")

    if reasons:
        return True, "; ".join(reasons)
    return False, "no drift and insufficient new data — retraining not required"


def trigger_retraining(dataset_path: str, model_dir: str) -> dict[str, Any]:
    """Retrain and register a new model version from ``dataset_path``."""
    return train_and_register(
        dataset_path=dataset_path,
        model_dir=model_dir,
        experiment_name=config.EXPERIMENT_NAME,
    )


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Trigger a VaniAI model retrain.")
    parser.add_argument(
        "--dataset",
        default=str(config.get_default_dataset_path()),
        help="Path to the training CSV.",
    )
    parser.add_argument(
        "--model-dir",
        default=str(config.get_model_dir()),
        help="Directory holding versioned model artifacts.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_arg_parser().parse_args(argv)
    result = trigger_retraining(args.dataset, args.model_dir)
    version = result.get("version", "?")
    model_type = result.get("model_type", "?")
    print(f"Retraining complete: registered {version} ({model_type}).")
    metrics = result.get("metrics", {})
    if metrics:
        print("Metrics:")
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                print(f"  {key}: {value:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
