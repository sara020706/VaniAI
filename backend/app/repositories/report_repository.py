"""Data-access helpers for generated PDF report records."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.report import Report


class ReportRepository:
    """Read/write access to ``reports`` rows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        student_id: int | None,
        report_type: str,
        file_path: str,
        generated_by: int,
    ) -> Report:
        """Insert and flush a new report row (id populated, not committed)."""
        report = Report(
            student_id=student_id,
            report_type=report_type,
            file_path=file_path,
            generated_by=generated_by,
        )
        self.db.add(report)
        self.db.flush()
        return report

    def get(self, report_id: int) -> Report | None:
        """Return a report by id, or ``None``."""
        return self.db.get(Report, report_id)

    def list_for_student(self, student_id: int) -> list[Report]:
        """Return all reports for a student, newest first."""
        stmt = (
            select(Report)
            .where(Report.student_id == student_id)
            .order_by(Report.created_at.desc(), Report.id.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
