"""Student profile tests: snapshot history, list filters, and self-access rules."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import auth_headers, make_login_for_role, register_student


def _register_and_auth(
    client: TestClient,
    *,
    email: str,
    register_number: str,
    department: str = "CSE",
    batch: str = "2026",
) -> dict[str, str]:
    register_student(
        client,
        email=email,
        register_number=register_number,
        department=department,
        batch=batch,
    )
    return auth_headers(client, email, "Password@123")


def test_get_me_returns_full_student_shape(client: TestClient) -> None:
    headers = _register_and_auth(client, email="stud1@example.com", register_number="21CSE200")
    response = client.get("/api/v1/students/me", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    for key in ("academic", "skills", "experience", "professional"):
        assert key in body
    assert body["register_number"] == "21CSE200"
    assert body["experience"]["project_count"] == 0


def test_update_me_creates_academic_and_skill_snapshots(
    client: TestClient, db_session: Session
) -> None:
    headers = _register_and_auth(client, email="stud2@example.com", register_number="21CSE201")

    first = client.put(
        "/api/v1/students/me",
        headers=headers,
        json={"cgpa": 7.5, "coding_score": 60.0, "attendance_percentage": 80.0},
    )
    assert first.status_code == 200, first.text
    assert first.json()["academic"]["cgpa"] == 7.5

    second = client.put(
        "/api/v1/students/me",
        headers=headers,
        json={"cgpa": 8.2, "coding_score": 72.0, "attendance_percentage": 85.0},
    )
    assert second.status_code == 200, second.text
    assert second.json()["academic"]["cgpa"] == 8.2

    # Two updates that changed academic/skill values must produce two snapshots each.
    from app.models.student import AcademicRecord, SkillRecord

    academic_count = db_session.query(AcademicRecord).count()
    skill_count = db_session.query(SkillRecord).count()
    assert academic_count >= 2
    assert skill_count >= 2


def test_update_me_reflects_latest_values(client: TestClient) -> None:
    headers = _register_and_auth(client, email="stud3@example.com", register_number="21CSE202")
    client.put("/api/v1/students/me", headers=headers, json={"communication_score": 55.0})
    client.put("/api/v1/students/me", headers=headers, json={"communication_score": 88.0})
    response = client.get("/api/v1/students/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["skills"]["communication_score"] == 88.0


def test_progress_history_grows_with_updates(client: TestClient) -> None:
    headers = _register_and_auth(client, email="stud4@example.com", register_number="21CSE203")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    client.put("/api/v1/students/me", headers=headers, json={"cgpa": 6.5})
    client.put("/api/v1/students/me", headers=headers, json={"cgpa": 7.0})

    response = client.get(f"/api/v1/students/{student_id}/progress", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "academic_history" in body
    assert "skill_history" in body
    assert "prediction_history" in body
    assert len(body["academic_history"]) >= 2


def test_faculty_can_list_students_with_filters(
    client: TestClient, db_session: Session
) -> None:
    _register_and_auth(client, email="cse1@example.com", register_number="21CSE300", department="CSE")
    _register_and_auth(client, email="ece1@example.com", register_number="21ECE300", department="ECE")

    headers = make_login_for_role(client, db_session, role="faculty", email="fac@example.com")

    all_students = client.get("/api/v1/students", headers=headers)
    assert all_students.status_code == 200, all_students.text
    assert all_students.json()["total"] >= 2

    cse_only = client.get("/api/v1/students", headers=headers, params={"department": "CSE"})
    assert cse_only.status_code == 200, cse_only.text
    departments = {item["department"] for item in cse_only.json()["items"]}
    assert departments == {"CSE"}


def test_students_list_forbidden_for_students(client: TestClient) -> None:
    headers = _register_and_auth(client, email="stud5@example.com", register_number="21CSE204")
    response = client.get("/api/v1/students", headers=headers)
    assert response.status_code == 403, response.text


def test_student_can_only_access_own_record(client: TestClient) -> None:
    headers_a = _register_and_auth(client, email="owner@example.com", register_number="21CSE205")
    headers_b = _register_and_auth(client, email="other@example.com", register_number="21CSE206")

    own_id = client.get("/api/v1/students/me", headers=headers_a).json()["id"]
    other_id = client.get("/api/v1/students/me", headers=headers_b).json()["id"]
    assert own_id != other_id

    # A student may read their own detail...
    own = client.get(f"/api/v1/students/{own_id}", headers=headers_a)
    assert own.status_code == 200, own.text
    # ...but not another student's.
    forbidden = client.get(f"/api/v1/students/{other_id}", headers=headers_a)
    assert forbidden.status_code == 403, forbidden.text


def test_faculty_can_access_any_student(client: TestClient, db_session: Session) -> None:
    _register_and_auth(client, email="target@example.com", register_number="21CSE207")
    target_headers = auth_headers(client, "target@example.com", "Password@123")
    target_id = client.get("/api/v1/students/me", headers=target_headers).json()["id"]

    faculty_headers = make_login_for_role(
        client, db_session, role="placement_officer", email="po@example.com"
    )
    response = client.get(f"/api/v1/students/{target_id}", headers=faculty_headers)
    assert response.status_code == 200, response.text
