"""Data-access helpers for resume analyses."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.student import ResumeAnalysis


class ResumeRepository:
    """Read/write access to ``resume_analyses`` rows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        student_id: int,
        filename: str,
        file_path: str,
        resume_score: float,
        ats_score: float,
        extracted: dict[str, Any],
        missing_sections: list[str],
        suggestions: list[str],
    ) -> ResumeAnalysis:
        """Insert and flush a new resume-analysis row (id populated, not committed)."""
        analysis = ResumeAnalysis(
            student_id=student_id,
            filename=filename,
            file_path=file_path,
            resume_score=resume_score,
            ats_score=ats_score,
            extracted=extracted,
            missing_sections=missing_sections,
            suggestions=suggestions,
        )
        self.db.add(analysis)
        self.db.flush()
        return analysis

    def get_latest_for_student(self, student_id: int) -> ResumeAnalysis | None:
        """Return the most recent resume analysis for a student, or ``None``."""
        stmt = (
            select(ResumeAnalysis)
            .where(ResumeAnalysis.student_id == student_id)
            .order_by(ResumeAnalysis.created_at.desc(), ResumeAnalysis.id.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()
