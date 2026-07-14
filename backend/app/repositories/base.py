"""Generic SQLAlchemy repository base class.

Repositories own all database access; services depend on repositories and never
touch the ``Session`` directly for queries. This base provides the common
CRUD primitives shared by :class:`UserRepository` and :class:`StudentRepository`.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Thin, typed wrapper over common ORM operations for a single model."""

    def __init__(self, session: Session, model: type[ModelT]) -> None:
        self.session = session
        self.model = model

    def get(self, entity_id: int) -> ModelT | None:
        """Fetch by primary key, or ``None`` if absent."""
        return self.session.get(self.model, entity_id)

    def get_by(self, **filters: Any) -> ModelT | None:
        """Fetch the first row matching equality ``filters``, or ``None``."""
        stmt = select(self.model).filter_by(**filters).limit(1)
        return self.session.execute(stmt).scalar_one_or_none()

    def list(self, **filters: Any) -> Sequence[ModelT]:
        """Return all rows matching equality ``filters`` (unpaginated)."""
        stmt = select(self.model).filter_by(**filters)
        return self.session.execute(stmt).scalars().all()

    def count(self, **filters: Any) -> int:
        """Count rows matching equality ``filters``."""
        stmt = select(func.count()).select_from(self.model).filter_by(**filters)
        return int(self.session.execute(stmt).scalar_one())

    def add(self, entity: ModelT) -> ModelT:
        """Stage ``entity`` for insert and flush so its PK is populated."""
        self.session.add(entity)
        self.session.flush()
        return entity

    def delete(self, entity: ModelT) -> None:
        """Stage ``entity`` for deletion."""
        self.session.delete(entity)
        self.session.flush()

    def flush(self) -> None:
        """Flush pending changes without committing."""
        self.session.flush()
