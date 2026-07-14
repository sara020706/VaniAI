"""Shared model helpers: UTC timestamp default and created/updated mixin."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Timezone-aware current UTC timestamp (column default)."""
    return datetime.now(UTC)


class TimestampMixin:
    """Adds timezone-aware ``created_at`` / ``updated_at`` columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )
