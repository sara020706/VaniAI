"""SHAP-based prediction explanations (CONTRACTS.md §6.3).

``explain_prediction(predictor, features)`` returns::

    {
      "top_positive": [{"feature", "label", "impact"}],   # <= 5, impact > 0
      "top_negative": [{"feature", "label", "impact"}],   # <= 5, impact < 0
      "feature_importance": [{"feature", "label", "importance"}],  # all, desc
    }

Strategy: TreeExplainer for tree models, LinearExplainer for linear models, and
a deterministic pseudo-SHAP (weight x deviation) for the heuristic fallback.
This function must NEVER raise — any failure degrades to model-derived
importances, then to heuristic weights.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ml.features.engineering import (
    FEATURE_LABELS,
    MODEL_COLUMNS,
    build_feature_frame,
)
from ml.inference.predictor import (
    _HEURISTIC_WEIGHTS,
    _normalize_feature,
    PlacementPredictor,
)

_TOP_N = 5


def _label(feature: str) -> str:
    return FEATURE_LABELS.get(feature, feature.replace("_", " ").title())


def _assemble(shap_values: dict[str, float]) -> dict[str, Any]:
    """Turn a {feature: signed_impact} map into the contract response dict."""
    ordered = sorted(shap_values.items(), key=lambda kv: kv[1], reverse=True)

    top_positive = [
        {"feature": f, "label": _label(f), "impact": round(float(v), 4)}
        for f, v in ordered
        if v > 0
    ][:_TOP_N]

    top_negative = [
        {"feature": f, "label": _label(f), "impact": round(float(v), 4)}
        for f, v in sorted(shap_values.items(), key=lambda kv: kv[1])
        if v < 0
    ][:_TOP_N]

    feature_importance = [
        {"feature": f, "label": _label(f), "importance": round(abs(float(v)), 4)}
        for f, v in sorted(
            shap_values.items(), key=lambda kv: abs(kv[1]), reverse=True
        )
    ]

    return {
        "top_positive": top_positive,
        "top_negative": top_negative,
        "feature_importance": feature_importance,
    }


def _heuristic_shap(features: dict) -> dict[str, float]:
    """Pseudo-SHAP for the fallback: weight x (normalized value - 0.5)."""
    from ml.features.engineering import FEATURE_COLUMNS, build_feature_row

    f = build_feature_row(features)
    contributions: dict[str, float] = {col: 0.0 for col in MODEL_COLUMNS}
    for column in FEATURE_COLUMNS:
        norm = _normalize_feature(column, f[column])
        contributions[column] = _HEURISTIC_WEIGHTS[column] * (norm - 0.5)
    return contributions


def _model_importance_fallback(predictor: PlacementPredictor, features: dict) -> dict[str, float]:
    """Signed-ish importances from a trained model when SHAP itself fails."""
    columns = predictor.feature_names()
    pipeline = predictor.pipeline
    estimator = pipeline.steps[-1][1] if hasattr(pipeline, "steps") else pipeline

    frame = build_feature_frame([features])
    row = frame.iloc[0]

    importances: np.ndarray | None = None
    signed = False
    if hasattr(estimator, "feature_importances_"):
        importances = np.asarray(estimator.feature_importances_, dtype=float)
    elif hasattr(estimator, "coef_"):
        importances = np.asarray(estimator.coef_, dtype=float).ravel()
        signed = True

    if importances is None or len(importances) != len(columns):
        return _heuristic_shap(features)

    result: dict[str, float] = {}
    for col, imp in zip(columns, importances):
        # Direction from how far the value sits from the column mean-ish (0.5 of range).
        centered = float(row.get(col, 0.0))
        if signed:
            result[col] = float(imp) * (centered / 100.0 if centered else 1.0)
        else:
            # Unsigned importances: sign by whether the value is high or low.
            result[col] = float(imp) * (1.0 if centered >= 0 else -1.0)
    return result


def explain_prediction(predictor: PlacementPredictor, features: dict) -> dict[str, Any]:
    """Return the explanation dict; never raises."""
    if predictor is None or getattr(predictor, "is_fallback", True) or predictor.pipeline is None:
        return _assemble(_heuristic_shap(features))

    try:
        return _assemble(_shap_values(predictor, features))
    except Exception:  # noqa: BLE001 - any SHAP failure -> model/heuristic fallback
        try:
            return _assemble(_model_importance_fallback(predictor, features))
        except Exception:  # noqa: BLE001
            return _assemble(_heuristic_shap(features))


def _shap_values(predictor: PlacementPredictor, features: dict) -> dict[str, float]:
    """Compute real SHAP values against the scaled model space."""
    import shap  # local import: heavy, and keeps module import cheap

    columns = predictor.feature_names()
    pipeline = predictor.pipeline
    frame = build_feature_frame([features])[columns]

    # Split the pipeline: transform up to the final estimator, explain the estimator.
    if hasattr(pipeline, "steps") and len(pipeline.steps) > 1:
        pre = pipeline[:-1]
        estimator = pipeline.steps[-1][1]
        transformed = pre.transform(frame)
    else:
        estimator = pipeline.steps[-1][1] if hasattr(pipeline, "steps") else pipeline
        transformed = frame.to_numpy()

    transformed = np.asarray(transformed, dtype=float)

    estimator_name = type(estimator).__name__.lower()
    if "forest" in estimator_name or "xgb" in estimator_name or "boost" in estimator_name:
        explainer = shap.TreeExplainer(estimator)
        raw = explainer.shap_values(transformed)
    elif hasattr(estimator, "coef_"):
        background = np.zeros((1, transformed.shape[1]))
        explainer = shap.LinearExplainer(estimator, background)
        raw = explainer.shap_values(transformed)
    else:
        background = np.zeros((1, transformed.shape[1]))
        explainer = shap.KernelExplainer(estimator.predict_proba, background)
        raw = explainer.shap_values(transformed)

    values = _extract_positive_class(raw)
    return {col: float(values[i]) for i, col in enumerate(columns)}


def _extract_positive_class(raw: Any) -> np.ndarray:
    """Normalize SHAP output (list per class, 2D/3D arrays) to a 1D vector."""
    if isinstance(raw, list):
        arr = np.asarray(raw[-1])  # positive class
    else:
        arr = np.asarray(raw)
    arr = np.asarray(arr, dtype=float)
    if arr.ndim == 3:  # (samples, features, classes)
        arr = arr[0, :, -1]
    elif arr.ndim == 2:  # (samples, features)
        arr = arr[0]
    return arr.ravel()
