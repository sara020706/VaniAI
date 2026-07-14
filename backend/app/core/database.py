"""SQLAlchemy 2.0 engine, session factory, and declarative base."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    # Allow the same connection across threads for sqlite (tests / dev convenience).
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **_engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


class Base(DeclarativeBase):
    """Declarative base for all VaniAI ORM models."""


def get_session() -> Generator[Session, None, None]:
    """Yield a database session, guaranteeing it is closed afterwards."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
