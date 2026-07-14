"""Auth flow tests: register, login, refresh, /me, and role-based access control."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import auth_headers, login, make_login_for_role, register_student


def test_register_creates_student_user_and_profile(client: TestClient) -> None:
    body = register_student(client, email="alice@example.com", register_number="21CSE100")
    assert body["email"] == "alice@example.com"
    assert body["role"] == "student"
    assert body["is_active"] is True
    assert "id" in body and "created_at" in body
    # No password material must ever leak in the response.
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_conflicts(client: TestClient) -> None:
    register_student(client, email="dup@example.com", register_number="21CSE101")
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "Password@123",
            "full_name": "Dup",
            "register_number": "21CSE102",
            "department": "CSE",
            "batch": "2026",
            "semester": 6,
        },
    )
    assert response.status_code == 409, response.text


def test_login_returns_tokens_and_user(client: TestClient) -> None:
    register_student(client, email="bob@example.com", register_number="21CSE103")
    tokens = login(client, "bob@example.com", "Password@123")
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert tokens["user"]["email"] == "bob@example.com"


def test_login_wrong_password_rejected(client: TestClient) -> None:
    register_student(client, email="carol@example.com", register_number="21CSE104")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "carol@example.com", "password": "WrongPass@1"},
    )
    assert response.status_code == 401, response.text


def test_refresh_rotates_tokens(client: TestClient) -> None:
    register_student(client, email="dave@example.com", register_number="21CSE105")
    tokens = login(client, "dave@example.com", "Password@123")
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert response.status_code == 200, response.text
    refreshed = response.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"]
    # The old refresh token must no longer be usable (rotation).
    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert replay.status_code == 401, replay.text


def test_me_returns_current_user(client: TestClient) -> None:
    register_student(client, email="erin@example.com", register_number="21CSE106")
    headers = auth_headers(client, "erin@example.com", "Password@123")
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "erin@example.com"


def test_me_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401, response.text


def test_me_rejects_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401, response.text


def test_rbac_student_cannot_access_admin_users(
    client: TestClient, db_session: Session
) -> None:
    headers = make_login_for_role(client, db_session, role="student", email="s1@example.com")
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 403, response.text


def test_rbac_admin_can_access_admin_users(
    client: TestClient, db_session: Session
) -> None:
    headers = make_login_for_role(client, db_session, role="admin", email="a1@example.com")
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body.keys()) == {"items", "total", "page", "page_size"}


def test_rbac_faculty_forbidden_from_admin(
    client: TestClient, db_session: Session
) -> None:
    headers = make_login_for_role(client, db_session, role="faculty", email="f1@example.com")
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 403, response.text


def test_inactive_user_forbidden(client: TestClient, db_session: Session) -> None:
    from tests.conftest import create_user

    create_user(db_session, email="ghost@example.com", role="student")
    headers = auth_headers(client, "ghost@example.com", "Password@123")
    # Deactivate after obtaining a token.
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "ghost@example.com").one()
    user.is_active = False
    db_session.commit()

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 403, response.text
