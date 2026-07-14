"""Generated PDF report records."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.common import utcnow


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=True
    )
    report_type: Mapped[str] = mapped_column(String(32), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    generated_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
