"""Shared pytest fixtures: SQLite DB, FastAPI TestClient, and auth helpers.

The suite is fully offline. Environment variables are set *before* any ``app.*``
import so that pydantic-settings binds to a temporary SQLite database and
scratch artifact/upload directories. The ``get_db`` dependency is overridden to
use a dedicated test engine, and tables are created/dropped per test for
isolation.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

# --- Environment must be configured before importing the application ----------------

_TMP_ROOT = Path(tempfile.mkdtemp(prefix="vaniai_test_"))
_DB_PATH = _TMP_ROOT / "test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["MODEL_DIR"] = str(_TMP_ROOT / "ml_artifacts")
os.environ["UPLOAD_DIR"] = str(_TMP_ROOT / "uploads")
os.environ["MLFLOW_TRACKING_URI"] = ""
os.environ["ENVIRONMENT"] = "testing"
os.environ["AUTO_CREATE_TABLES"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  (registers every table on Base.metadata)
from app.api.deps import get_db  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.models.student import Student  # noqa: E402
from app.models.user import User  # noqa: E402

# A single shared in-memory SQLite engine (StaticPool keeps one connection so the
# schema persists across sessions within a test).
_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(
    bind=_test_engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=Session
)


@pytest.fixture(autouse=True)
def _schema() -> Generator[None, None, None]:
    """Create all tables before each test and drop them afterwards (isolation)."""
    Base.metadata.create_all(bind=_test_engine)
    try:
        yield
    finally:
        Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """A raw SQLAlchemy session bound to the test engine."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """FastAPI ``TestClient`` with ``get_db`` overridden to the test engine."""

    def _override_get_db() -> Generator[Session, None, None]:
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.pop(get_db, None)


# --- User / auth helpers ------------------------------------------------------------


def create_user(
    session: Session,
    *,
    email: str,
    password: str = "Password@123",
    full_name: str = "Test User",
    role: str = "student",
    is_active: bool = True,
) -> User:
    """Insert a user directly and return it (committed)."""
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=is_active,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_student_profile(
    session: Session,
    user: User,
    *,
    register_number: str = "21CSE001",
    department: str = "CSE",
    batch: str = "2026",
    semester: int = 6,
) -> Student:
    """Attach an (empty) student profile to a user and return it."""
    student = Student(
        user_id=user.id,
        register_number=register_number,
        department=department,
        batch=batch,
        semester=semester,
    )
    session.add(student)
    session.commit()
    session.refresh(student)
    return student


@pytest.fixture
def make_user(db_session: Session):
    """Factory fixture: create a user with arbitrary attributes."""

    def _make(
        *,
        email: str,
        password: str = "Password@123",
        full_name: str = "Test User",
        role: str = "student",
        is_active: bool = True,
    ) -> User:
        return create_user(
            db_session,
            email=email,
            password=password,
            full_name=full_name,
            role=role,
            is_active=is_active,
        )

    return _make


def register_student(
    client: TestClient,
    *,
    email: str = "newstudent@example.com",
    password: str = "Password@123",
    full_name: str = "New Student",
    register_number: str = "21CSE099",
    department: str = "CSE",
    batch: str = "2026",
    semester: int = 6,
) -> dict:
    """Register a student via the public API and return the parsed response body."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "register_number": register_number,
            "department": department,
            "batch": batch,
            "semester": semester,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def login(client: TestClient, email: str, password: str) -> dict:
    """Log in via the API and return the token payload."""
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    """Return an ``Authorization: Bearer`` header for the given credentials."""
    tokens = login(client, email, password)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def make_login_for_role(
    client: TestClient,
    db_session: Session,
    *,
    role: str,
    email: str | None = None,
    password: str = "Password@123",
) -> dict[str, str]:
    """Create a user of ``role`` directly in the DB, then return auth headers."""
    resolved_email = email or f"{role}@example.com"
    create_user(db_session, email=resolved_email, password=password, role=role)
    return auth_headers(client, resolved_email, password)
