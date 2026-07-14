"""Serialize a persisted ``Prediction`` row into the ``PredictionOut`` schema.

The prediction pipeline (B3) persists the probability, risk, readiness, and
SHAP explanation on the ``predictions`` row and the recommendations on the
``recommendations`` table. ``skill_gaps`` and ``career_recommendations`` are
computed live by the pipeline and returned by the prediction endpoints; they
are not stored, so when reconstructing a persisted prediction for embedding in
``StudentOut.latest_prediction`` / faculty views they serialize as empty lists.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.models.prediction import Prediction, Recommendation
from app.schemas.prediction import (
    Explanation,
    PredictionOut,
    Readiness,
    RecommendationOut,
)


def _readiness_from_json(data: object) -> Readiness:
    payload = data if isinstance(data, dict) else {}
    return Readiness(
        academic=float(payload.get("academic", 0.0)),
        technical=float(payload.get("technical", 0.0)),
        communication=float(payload.get("communication", 0.0)),
        industry=float(payload.get("industry", 0.0)),
        overall=float(payload.get("overall", 0.0)),
    )


def _explanation_from_json(data: object) -> Explanation:
    payload = data if isinstance(data, dict) else {}
    return Explanation(
        top_positive=payload.get("top_positive", []) or [],
        top_negative=payload.get("top_negative", []) or [],
        feature_importance=payload.get("feature_importance", []) or [],
    )


def prediction_to_out(
    prediction: Prediction, recommendations: Sequence[Recommendation]
) -> PredictionOut:
    """Build a full ``PredictionOut`` from a stored prediction and its recs."""
    risk_reasons = [str(reason) for reason in (prediction.risk_reasons or [])]
    rec_out = [RecommendationOut.model_validate(rec) for rec in recommendations]
    return PredictionOut(
        id=prediction.id,
        student_id=prediction.student_id,
        model_version=prediction.model_version,
        created_at=prediction.created_at,
        placement_probability=prediction.placement_probability,
        risk_level=prediction.risk_level,  # type: ignore[arg-type]
        risk_reasons=risk_reasons,
        readiness=_readiness_from_json(prediction.readiness),
        explanation=_explanation_from_json(prediction.explanation),
        skill_gaps=[],
        recommendations=rec_out,
        career_recommendations=[],
    )
