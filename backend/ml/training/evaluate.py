"""Model evaluation metrics (CONTRACTS.md §6.2 step 4).

``evaluate_model(pipeline, X_test, y_test)`` scores a fitted sklearn pipeline
and returns a JSON-serialisable metrics dict::

    {
        "accuracy": float,
        "precision": float,
        "recall": float,
        "f1": float,
        "roc_auc": float,
        "confusion_matrix": [[tn, fp], [fn, tp]],
    }

All floats are plain Python ``float`` (not numpy scalars) so the dict can be
written straight to ``metadata.json`` / logged to MLflow. ROC-AUC uses the
positive-class probability when the estimator exposes ``predict_proba`` and
degrades gracefully to ``decision_function`` or the hard predictions.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

#: Metric keys produced by :func:`evaluate_model`, in canonical order.
METRIC_KEYS: list[str] = ["accuracy", "precision", "recall", "f1", "roc_auc"]


def _positive_scores(pipeline: Any, X_test: Any) -> np.ndarray | None:
    """Best-available continuous score for the positive class, or ``None``."""
    if hasattr(pipeline, "predict_proba"):
        proba = np.asarray(pipeline.predict_proba(X_test))
        if proba.ndim == 2 and proba.shape[1] >= 2:
            return proba[:, 1]
        return proba.ravel()
    if hasattr(pipeline, "decision_function"):
        return np.asarray(pipeline.decision_function(X_test)).ravel()
    return None


def evaluate_model(pipeline: Any, X_test: Any, y_test: Any) -> dict[str, Any]:
    """Compute classification metrics for a fitted ``pipeline`` on the test set."""
    y_true = np.asarray(y_test).ravel()
    y_pred = np.asarray(pipeline.predict(X_test)).ravel()

    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }

    # ROC-AUC needs both classes present in y_true and a continuous score.
    roc_auc = 0.0
    scores = _positive_scores(pipeline, X_test)
    if scores is not None and len(np.unique(y_true)) >= 2:
        try:
            roc_auc = float(roc_auc_score(y_true, scores))
        except ValueError:
            roc_auc = 0.0
    metrics["roc_auc"] = roc_auc

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    metrics["confusion_matrix"] = [[int(v) for v in row] for row in cm]

    return metrics
