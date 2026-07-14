"""Prediction pipeline orchestration.

Assembles a student's latest records into a feature profile, runs the ML
inference/recommendation stack, persists the prediction plus its recommendations,
updates Prometheus metrics, and returns the full ``PredictionOut`` payload.

The module-level :func:`run_prediction_for_student` is the public entrypoint used
by both the API layer and the seed script; it MUST keep this exact name/signature.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import metrics
from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.models.prediction import Prediction, Recommendation
from app.models.student import (
    AcademicRecord,
    Certification,
    Hackathon,
    Internship,
    InterviewScore,
    Project,
    ResumeAnalysis,
    SkillRecord,
    Student,
)
from app.repositories.prediction_repository import PredictionRepository
from ml.features.engineering import build_feature_row
from ml.inference.explainer import explain_prediction
from ml.inference.predictor import get_predictor
from ml.inference.readiness import compute_readiness
from ml.inference.risk import classify_risk
from ml.recommendation.career import identify_skill_gaps, recommend_careers
from ml.recommendation.engine import generate_recommendations

# Defaults applied when a student has no recorded value yet (contracts 6.1).
_DEFAULT_SCORE = 50.0
_DEFAULT_CGPA = 6.0


def _latest_academic(db: Session, student_id: int) -> AcademicRecord | None:
    stmt = (
        select(AcademicRecord)
        .where(AcademicRecord.student_id == student_id)
        .order_by(AcademicRecord.recorded_at.desc(), AcademicRecord.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _latest_skill(db: Session, student_id: int) -> SkillRecord | None:
    stmt = (
        select(SkillRecord)
        .where(SkillRecord.student_id == student_id)
        .order_by(SkillRecord.recorded_at.desc(), SkillRecord.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _latest_resume_score(db: Session, student_id: int) -> float | None:
    stmt = (
        select(ResumeAnalysis.resume_score)
        .where(ResumeAnalysis.student_id == student_id)
        .order_by(ResumeAnalysis.created_at.desc(), ResumeAnalysis.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _latest_interview_score(db: Session, student_id: int) -> float | None:
    stmt = (
        select(InterviewScore.mock_interview_score)
        .where(InterviewScore.student_id == student_id)
        .order_by(InterviewScore.created_at.desc(), InterviewScore.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _count(db: Session, model: Any, student_id: int) -> int:
    stmt = select(func.count()).select_from(model).where(model.student_id == student_id)
    return int(db.execute(stmt).scalar_one())


def build_student_profile(db: Session, student_id: int) -> dict[str, Any]:
    """Assemble a raw feature profile from the student's latest records + counts.

    Missing values are filled with contract defaults (counts 0, scores 50.0,
    cgpa 6.0) here as well as inside ``build_feature_row``; supplying them
    explicitly keeps this dict self-describing for callers/tests.
    """
    academic = _latest_academic(db, student_id)
    skill = _latest_skill(db, student_id)
    resume_score = _latest_resume_score(db, student_id)
    mock_interview_score = _latest_interview_score(db, student_id)

    profile: dict[str, Any] = {
        "cgpa": academic.cgpa if academic is not None else _DEFAULT_CGPA,
        "tenth_percentage": (
            academic.tenth_percentage if academic is not None else _DEFAULT_SCORE
        ),
        "twelfth_percentage": (
            academic.twelfth_percentage if academic is not None else _DEFAULT_SCORE
        ),
        "attendance_percentage": (
            academic.attendance_percentage if academic is not None else _DEFAULT_SCORE
        ),
        "coding_score": skill.coding_score if skill is not None else _DEFAULT_SCORE,
        "aptitude_score": skill.aptitude_score if skill is not None else _DEFAULT_SCORE,
        "communication_score": (
            skill.communication_score if skill is not None else _DEFAULT_SCORE
        ),
        "technical_skill_score": (
            skill.technical_skill_score if skill is not None else _DEFAULT_SCORE
        ),
        "leadership_score": skill.leadership_score if skill is not None else _DEFAULT_SCORE,
        "internship_count": _count(db, Internship, student_id),
        "project_count": _count(db, Project, student_id),
        "certification_count": _count(db, Certification, student_id),
        "hackathon_count": _count(db, Hackathon, student_id),
        "resume_score": resume_score if resume_score is not None else _DEFAULT_SCORE,
        "mock_interview_score": (
            mock_interview_score if mock_interview_score is not None else _DEFAULT_SCORE
        ),
    }
    return profile


def _serialize_prediction(
    prediction: Prediction,
    *,
    skill_gaps: list[dict[str, Any]],
    recommendations: list[Recommendation],
    career_recommendations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the full ``PredictionOut``-shaped dict from a persisted prediction."""
    return {
        "id": prediction.id,
        "student_id": prediction.student_id,
        "model_version": prediction.model_version,
        "created_at": prediction.created_at,
        "placement_probability": prediction.placement_probability,
        "risk_level": prediction.risk_level,
        "risk_reasons": list(prediction.risk_reasons),
        "readiness": dict(prediction.readiness),
        "explanation": dict(prediction.explanation),
        "skill_gaps": skill_gaps,
        "recommendations": [
            {
                "id": rec.id,
                "category": rec.category,
                "priority": rec.priority,
                "text": rec.text,
            }
            for rec in recommendations
        ],
        "career_recommendations": career_recommendations,
    }


def run_prediction_for_student(db: Session, student_id: int) -> dict[str, Any]:
    """Run the full prediction pipeline for a student and persist the result.

    Returns a dict matching the ``PredictionOut`` schema. Raises
    :class:`NotFoundError` if the student does not exist.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")

    settings = get_settings()

    # 1. Assemble raw profile from latest records, then normalize + engineer features.
    profile = build_student_profile(db, student_id)
    features = build_feature_row(profile)

    # 2. Model inference.
    predictor = get_predictor(settings.model_dir)
    probability = float(predictor.predict_proba(features))
    probability = min(1.0, max(0.0, probability))

    # 3. Readiness, risk, explanation.
    readiness = compute_readiness(features)
    risk_level, risk_reasons = classify_risk(probability, features, readiness)
    explanation = explain_prediction(predictor, features)

    # 4. Recommendations, careers, skill gaps.
    recommendation_items = generate_recommendations(
        features, readiness, probability, explanation
    )
    career_recommendations = recommend_careers(features)
    skill_gaps = identify_skill_gaps(features, readiness)

    # 5. Persist prediction + recommendations.
    repo = PredictionRepository(db)
    prediction = repo.create_prediction(
        student_id=student_id,
        model_version=predictor.model_version,
        placement_probability=probability,
        risk_level=risk_level,
        risk_reasons=[str(reason) for reason in risk_reasons],
        readiness=readiness,
        explanation=explanation,
    )
    recommendations = repo.create_recommendations(
        prediction_id=prediction.id,
        student_id=student_id,
        items=recommendation_items,
    )
    db.commit()
    db.refresh(prediction)

    # 6. Metrics.
    metrics.record_prediction(probability)

    return _serialize_prediction(
        prediction,
        skill_gaps=skill_gaps,
        recommendations=recommendations,
        career_recommendations=career_recommendations,
    )


def get_latest_prediction(db: Session, student_id: int) -> dict[str, Any]:
    """Return the latest persisted prediction as a ``PredictionOut`` dict.

    Recomputes the (non-persisted) skill-gap and career-recommendation views from
    the student's current profile so the payload is complete. Raises
    :class:`NotFoundError` if the student or a prediction is missing.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")

    repo = PredictionRepository(db)
    prediction = repo.get_latest_for_student(student_id)
    if prediction is None:
        raise NotFoundError("No prediction found for this student")

    recommendations = repo.get_recommendations_for_prediction(prediction.id)

    profile = build_student_profile(db, student_id)
    features = build_feature_row(profile)
    readiness = dict(prediction.readiness)
    career_recommendations = recommend_careers(features)
    skill_gaps = identify_skill_gaps(features, readiness)

    return _serialize_prediction(
        prediction,
        skill_gaps=skill_gaps,
        recommendations=recommendations,
        career_recommendations=career_recommendations,
    )


def get_prediction_history(db: Session, student_id: int) -> list[dict[str, Any]]:
    """Return the student's prediction history as ``PredictionHistoryItem`` dicts."""
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")

    repo = PredictionRepository(db)
    history = repo.get_history_for_student(student_id)
    return [
        {
            "id": prediction.id,
            "created_at": prediction.created_at,
            "placement_probability": prediction.placement_probability,
            "risk_level": prediction.risk_level,
            "readiness_overall": float(prediction.readiness.get("overall", 0.0)),
            "model_version": prediction.model_version,
        }
        for prediction in history
    ]
