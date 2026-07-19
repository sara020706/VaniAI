"""Drift detection (CONTRACTS.md §6.6).

- ``run_drift_report(reference_df, current_df)`` uses Evidently's
  ``DataDriftPreset`` and returns
  ``{"data_drift_detected", "share_drifted", "drifted_features", "n_features"}``.
  Evidently is imported lazily; if it is unavailable the function degrades to a
  manual mean/std-shift heuristic so the endpoint still works.
- ``run_prediction_drift(ref_probs, cur_probs)`` computes PSI manually over 10
  quantile bins and returns ``{"psi", "drift_detected"}`` (drift if PSI > 0.2).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

_PSI_DRIFT_THRESHOLD = 0.2
_DATA_DRIFT_SHARE_THRESHOLD = 0.5


def run_drift_report(reference_df: pd.DataFrame, current_df: pd.DataFrame) -> dict[str, Any]:
    """Return a data-drift summary dict. Never raises."""
    common = [c for c in reference_df.columns if c in current_df.columns]
    ref = reference_df[common].apply(pd.to_numeric, errors="coerce").dropna(axis=1, how="all")
    cur = current_df[common].apply(pd.to_numeric, errors="coerce")
    cur = cur[[c for c in ref.columns]]

    try:
        return _evidently_report(ref, cur)
    except Exception:  # noqa: BLE001 - fall back to manual heuristic
        return _manual_report(ref, cur)


def _evidently_report(ref: pd.DataFrame, cur: pd.DataFrame) -> dict[str, Any]:
    from evidently.metric_preset import DataDriftPreset
    from evidently.report import Report

    report = Report(metrics=[DataDriftPreset()])
    report.run(reference_data=ref, current_data=cur)
    result = report.as_dict()

    drift_metric = next(
        m for m in result["metrics"] if m["metric"] == "DatasetDriftMetric"
    )
    payload = drift_metric["result"]
    n_features = int(payload.get("number_of_columns", len(ref.columns)))
    n_drifted = int(payload.get("number_of_drifted_columns", 0))
    share = float(payload.get("share_of_drifted_columns", 0.0))

    drifted_features: list[str] = []
    for by_col in result["metrics"]:
        if by_col["metric"] == "DataDriftTable":
            columns = by_col["result"].get("drift_by_columns", {})
            drifted_features = [
                name for name, info in columns.items() if info.get("drift_detected")
            ]
            break

    return {
        "data_drift_detected": bool(payload.get("dataset_drift", share >= _DATA_DRIFT_SHARE_THRESHOLD)),
        "share_drifted": round(share, 4),
        "drifted_features": drifted_features,
        "n_features": n_features,
    }


def _manual_report(ref: pd.DataFrame, cur: pd.DataFrame) -> dict[str, Any]:
    """Standardized mean-shift heuristic: a column drifts if the current mean is
    more than 2 reference std-devs from the reference mean (or PSI > 0.2)."""
    drifted: list[str] = []
    columns = list(ref.columns)
    for col in columns:
        ref_col = ref[col].dropna()
        cur_col = cur[col].dropna()
        if ref_col.empty or cur_col.empty:
            continue
        ref_std = float(ref_col.std(ddof=0)) or 1e-9
        mean_shift = abs(float(cur_col.mean()) - float(ref_col.mean())) / ref_std
        psi = _psi(ref_col.to_numpy(), cur_col.to_numpy())
        if mean_shift > 2.0 or psi > _PSI_DRIFT_THRESHOLD:
            drifted.append(col)

    n_features = len(columns)
    share = (len(drifted) / n_features) if n_features else 0.0
    return {
        "data_drift_detected": share >= _DATA_DRIFT_SHARE_THRESHOLD,
        "share_drifted": round(share, 4),
        "drifted_features": drifted,
        "n_features": n_features,
    }


def run_prediction_drift(ref_probs: list[float], cur_probs: list[float]) -> dict[str, Any]:
    """Population Stability Index over prediction probabilities."""
    reference = np.asarray(ref_probs, dtype=float)
    current = np.asarray(cur_probs, dtype=float)
    psi = _psi(reference, current)
    return {"psi": round(float(psi), 4), "drift_detected": bool(psi > _PSI_DRIFT_THRESHOLD)}


def _psi(reference: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
    """Compute PSI using ``bins`` quantile edges from the reference sample."""
    reference = reference[np.isfinite(reference)]
    current = current[np.isfinite(current)]
    if reference.size == 0 or current.size == 0:
        return 0.0

    quantiles = np.linspace(0, 1, bins + 1)
    edges = np.unique(np.quantile(reference, quantiles))
    if edges.size < 2:
        return 0.0
    edges[0], edges[-1] = -np.inf, np.inf

    ref_counts, _ = np.histogram(reference, bins=edges)
    cur_counts, _ = np.histogram(current, bins=edges)

    ref_frac = ref_counts / max(ref_counts.sum(), 1)
    cur_frac = cur_counts / max(cur_counts.sum(), 1)

    epsilon = 1e-6
    ref_frac = np.clip(ref_frac, epsilon, None)
    cur_frac = np.clip(cur_frac, epsilon, None)

    return float(np.sum((cur_frac - ref_frac) * np.log(cur_frac / ref_frac)))
