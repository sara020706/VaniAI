"""Prediction and recommendation models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.common import utcnow

if TYPE_CHECKING:
    from app.models.student import Student


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    placement_probability: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    risk_reasons: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    readiness: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    student: Mapped[Student] = relationship("Student", back_populates="predictions")
    recommendations: Mapped[list[Recommendation]] = relationship(
        "Recommendation", back_populates="prediction", cascade="all, delete-orphan"
    )


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    prediction: Mapped[Prediction] = relationship("Prediction", back_populates="recommendations")
    student: Mapped[Student] = relationship("Student", back_populates="recommendations")
