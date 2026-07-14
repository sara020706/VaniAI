"""Recommendation-related service helpers.

Thin orchestration layer over the ML recommendation stack. The prediction
pipeline (``prediction_service``) is the primary caller; these helpers exist so
other services (reports, analytics) can reuse recommendation/career/skill-gap
computation from a student's current profile without duplicating the feature
assembly logic.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.student import Student
from app.services.prediction_service import build_student_profile
from ml.features.engineering import build_feature_row
from ml.inference.readiness import compute_readiness
from ml.recommendation.career import identify_skill_gaps, recommend_careers
from ml.recommendation.engine import generate_recommendations


def _features_for_student(db: Session, student_id: int) -> dict[str, Any]:
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")
    profile = build_student_profile(db, student_id)
    return build_feature_row(profile)


def career_recommendations_for_student(db: Session, student_id: int) -> list[dict[str, Any]]:
    """Return the top career matches for a student's current profile."""
    features = _features_for_student(db, student_id)
    return recommend_careers(features)


def skill_gaps_for_student(db: Session, student_id: int) -> list[dict[str, Any]]:
    """Return the student's skill gaps against target thresholds."""
    features = _features_for_student(db, student_id)
    readiness = compute_readiness(features)
    return identify_skill_gaps(features, readiness)


def recommendations_for_student(
    db: Session, student_id: int, *, probability: float, explanation: dict[str, Any]
) -> list[dict[str, Any]]:
    """Generate rule-based improvement recommendations for a student.

    ``probability`` and ``explanation`` are supplied by the caller (typically the
    latest prediction) so recommendations stay consistent with what the student
    was last shown.
    """
    features = _features_for_student(db, student_id)
    readiness = compute_readiness(features)
    return generate_recommendations(features, readiness, probability, explanation)
