"""Data-access layer for monitoring logs and drift inputs (CONTRACTS.md section 5)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.ml import MonitoringLog
from app.models.prediction import Prediction
from app.models.student import (
    AcademicRecord,
    Certification,
    Hackathon,
    Internship,
    Project,
    ResumeAnalysis,
    SkillRecord,
    Student,
)


class MonitoringRepository:
    """Persist monitoring logs and gather the raw inputs drift checks need."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Monitoring logs -------------------------------------------------------------

    def create_log(
        self,
        *,
        metric_type: str,
        payload: dict[str, Any],
        drift_detected: bool,
    ) -> MonitoringLog:
        """Persist a monitoring log row (``data_drift`` | ``prediction_drift`` | ``system``)."""
        log = MonitoringLog(
            metric_type=metric_type,
            payload=payload,
            drift_detected=drift_detected,
        )
        self.db.add(log)
        self.db.flush()
        self.db.refresh(log)
        return log

    def recent_logs(self, *, limit: int = 20) -> Sequence[MonitoringLog]:
        """Return the most recent monitoring logs, newest first."""
        stmt = (
            select(MonitoringLog)
            .order_by(MonitoringLog.created_at.desc(), MonitoringLog.id.desc())
            .limit(limit)
        )
        return self.db.scalars(stmt).all()

    def latest_log(self, metric_type: str) -> MonitoringLog | None:
        """Most recent log of a given metric type, or ``None``."""
        stmt = (
            select(MonitoringLog)
            .where(MonitoringLog.metric_type == metric_type)
            .order_by(MonitoringLog.created_at.desc(), MonitoringLog.id.desc())
        )
        return self.db.scalars(stmt).first()

    # --- Drift inputs ----------------------------------------------------------------

    def all_students(self) -> Sequence[Student]:
        """Load every student with the relationships needed to rebuild features."""
        stmt = select(Student).options(
            selectinload(Student.academic_records),
            selectinload(Student.skill_records),
            selectinload(Student.projects),
            selectinload(Student.internships),
            selectinload(Student.certifications),
            selectinload(Student.hackathons),
            selectinload(Student.resume_analyses),
            selectinload(Student.interview_scores),
        )
        return self.db.scalars(stmt).all()

    def recent_prediction_probabilities(self, *, limit: int = 500) -> list[float]:
        """Return recent stored placement probabilities (newest first, capped)."""
        stmt = (
            select(Prediction.placement_probability)
            .order_by(Prediction.created_at.desc(), Prediction.id.desc())
            .limit(limit)
        )
        return [float(value) for value in self.db.scalars(stmt).all()]

    def latest_feature_rows(self) -> list[dict[str, Any]]:
        """Rebuild the latest feature-input dict for every student.

        Mirrors ``prediction_service`` feature assembly: latest academic + skill
        snapshot, experience counts, resume score, and mock interview score.
        Used as the "current" window for the data-drift check.
        """
        rows: list[dict[str, Any]] = []
        for student in self.all_students():
            rows.append(self._feature_row_for_student(student))
        return rows

    @staticmethod
    def _latest(records: Sequence[Any]) -> Any | None:
        """Return the record with the newest ``recorded_at`` (or ``None``)."""
        latest: Any | None = None
        for record in records:
            if latest is None or record.recorded_at > latest.recorded_at:
                latest = record
        return latest

    def _feature_row_for_student(self, student: Student) -> dict[str, Any]:
        """Assemble a raw feature dict (pre-normalization) for one student."""
        academic: AcademicRecord | None = self._latest(student.academic_records)
        skill: SkillRecord | None = self._latest(student.skill_records)

        resume: ResumeAnalysis | None = None
        for analysis in student.resume_analyses:
            if resume is None or analysis.created_at > resume.created_at:
                resume = analysis

        interview_score: float | None = None
        latest_created: Any | None = None
        for score in student.interview_scores:
            if latest_created is None or score.created_at > latest_created:
                latest_created = score.created_at
                interview_score = score.mock_interview_score

        row: dict[str, Any] = {
            "cgpa": academic.cgpa if academic else None,
            "tenth_percentage": academic.tenth_percentage if academic else None,
            "twelfth_percentage": academic.twelfth_percentage if academic else None,
            "attendance_percentage": academic.attendance_percentage if academic else None,
            "coding_score": skill.coding_score if skill else None,
            "aptitude_score": skill.aptitude_score if skill else None,
            "communication_score": skill.communication_score if skill else None,
            "technical_skill_score": skill.technical_skill_score if skill else None,
            "leadership_score": skill.leadership_score if skill else None,
            "internship_count": self._count(student.internships),
            "project_count": self._count(student.projects),
            "certification_count": self._count(student.certifications),
            "hackathon_count": self._count(student.hackathons),
            "resume_score": resume.resume_score if resume else None,
            "mock_interview_score": interview_score,
        }
        return row

    @staticmethod
    def _count(
        items: Sequence[Project | Internship | Certification | Hackathon],
    ) -> int:
        """Length of a sub-resource collection as a plain int."""
        return len(list(items))
