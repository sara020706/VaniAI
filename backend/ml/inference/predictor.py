"""Placement predictor with a trained-model path and a heuristic fallback
(CONTRACTS.md §6.3).

``PlacementPredictor.load(model_dir)`` loads ``active/model.joblib`` +
``metadata.json`` when present. When no artifact exists the predictor returns a
deterministic heuristic (a weighted sigmoid over normalized features) so the
application is fully functional before the first training run. A module-level
``get_predictor`` caches a singleton per model dir; ``reload_predictor`` swaps
it in after a deploy/retrain.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib

from ml.features.engineering import (
    FEATURE_COLUMNS,
    MODEL_COLUMNS,
    build_feature_frame,
    build_feature_row,
)

HEURISTIC_VERSION = "heuristic-v0"

# Heuristic weights over normalized (0-1) features; tuned so a strong profile
# lands near ~0.9 and a weak one near ~0.15. Only base features participate.
_HEURISTIC_WEIGHTS: dict[str, float] = {
    "cgpa": 1.6,
    "tenth_percentage": 0.3,
    "twelfth_percentage": 0.3,
    "attendance_percentage": 0.5,
    "coding_score": 1.5,
    "aptitude_score": 1.0,
    "communication_score": 0.9,
    "technical_skill_score": 1.1,
    "leadership_score": 0.4,
    "internship_count": 1.2,
    "project_count": 0.8,
    "certification_count": 0.5,
    "hackathon_count": 0.4,
    "resume_score": 0.8,
    "mock_interview_score": 0.9,
}
_HEURISTIC_BIAS = -5.3


def _normalize_feature(column: str, value: float) -> float:
    """Scale a raw feature to roughly 0-1 for the heuristic."""
    if column == "cgpa":
        return max(0.0, min(1.0, value / 10.0))
    if column == "internship_count":
        return max(0.0, min(1.0, value / 3.0))
    if column == "project_count":
        return max(0.0, min(1.0, value / 6.0))
    if column in {"certification_count", "hackathon_count"}:
        return max(0.0, min(1.0, value / 5.0))
    # All score/percentage columns are already 0-100.
    return max(0.0, min(1.0, value / 100.0))


def _heuristic_proba(features: dict) -> float:
    f = build_feature_row(features)
    z = _HEURISTIC_BIAS
    for column in FEATURE_COLUMNS:
        z += _HEURISTIC_WEIGHTS[column] * _normalize_feature(column, f[column])
    return 1.0 / (1.0 + math.exp(-z))


class PlacementPredictor:
    """Wraps a trained sklearn pipeline or a heuristic fallback."""

    def __init__(
        self,
        pipeline: Any | None,
        model_version: str,
        metadata: dict[str, Any] | None = None,
        *,
        is_fallback: bool = False,
    ) -> None:
        self.pipeline = pipeline
        self.model_version = model_version
        self.metadata = metadata or {}
        self.is_fallback = is_fallback

    @classmethod
    def load(cls, model_dir: str | Path) -> "PlacementPredictor":
        """Load the active model, or return a heuristic fallback if none exists."""
        active_dir = Path(model_dir) / "active"
        model_path = active_dir / "model.joblib"
        meta_path = active_dir / "metadata.json"
        if model_path.exists() and meta_path.exists():
            try:
                pipeline = joblib.load(model_path)
                metadata = json.loads(meta_path.read_text(encoding="utf-8"))
                version = str(metadata.get("version", "unknown"))
                return cls(pipeline, version, metadata, is_fallback=False)
            except Exception:  # noqa: BLE001 - corrupt artifact -> fall back gracefully
                pass
        return cls(None, HEURISTIC_VERSION, {"is_fallback": True}, is_fallback=True)

    def predict_proba(self, features: dict) -> float:
        """Return the placement probability (0-1) for a single feature dict."""
        if self.pipeline is None:
            return float(_heuristic_proba(features))
        frame = build_feature_frame([features])
        try:
            proba = self.pipeline.predict_proba(frame)
            value = float(proba[0][1])
        except (AttributeError, IndexError):
            # Model without predict_proba (rare) -> use decision/predict.
            prediction = self.pipeline.predict(frame)
            value = float(prediction[0])
        return min(1.0, max(0.0, value))

    def feature_names(self) -> list[str]:
        cols = self.metadata.get("feature_columns")
        return list(cols) if cols else list(MODEL_COLUMNS)


# --- Module-level cached singleton -------------------------------------------

_CACHE: dict[str, PlacementPredictor] = {}


def get_predictor(model_dir: str | Path) -> PlacementPredictor:
    """Return a cached predictor for ``model_dir`` (loads on first use)."""
    key = str(Path(model_dir))
    predictor = _CACHE.get(key)
    if predictor is None:
        predictor = PlacementPredictor.load(model_dir)
        _CACHE[key] = predictor
    return predictor


def reload_predictor(model_dir: str | Path) -> PlacementPredictor:
    """Force a fresh load (call after deploy/retrain) and update the cache."""
    key = str(Path(model_dir))
    predictor = PlacementPredictor.load(model_dir)
    _CACHE[key] = predictor
    return predictor
