"""Prediction pipeline tests against the heuristic fallback predictor.

No trained model artifact is required: with an empty ``MODEL_DIR`` the ML
predictor returns its deterministic heuristic fallback
(``model_version="heuristic-v0"``), so these tests validate the full
``PredictionOut`` shape end-to-end without any training step.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import auth_headers, make_login_for_role, register_student

_PREDICTION_KEYS = {
    "id",
    "student_id",
    "model_version",
    "created_at",
    "placement_probability",
    "risk_level",
    "risk_reasons",
    "readiness",
    "explanation",
    "skill_gaps",
    "recommendations",
    "career_recommendations",
}


def _seed_student(client: TestClient, *, email: str, register_number: str) -> dict[str, str]:
    register_student(client, email=email, register_number=register_number)
    headers = auth_headers(client, email, "Password@123")
    # Give the profile some non-default values so the pipeline has signal.
    client.put(
        "/api/v1/students/me",
        headers=headers,
        json={
            "cgpa": 7.8,
            "tenth_percentage": 82.0,
            "twelfth_percentage": 79.0,
            "attendance_percentage": 88.0,
            "coding_score": 74.0,
            "aptitude_score": 68.0,
            "communication_score": 71.0,
            "technical_skill_score": 76.0,
            "leadership_score": 60.0,
        },
    )
    return headers


def test_run_prediction_returns_full_shape(client: TestClient) -> None:
    headers = _seed_student(client, email="pred1@example.com", register_number="21CSE400")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    response = client.post(f"/api/v1/predictions/students/{student_id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert set(body.keys()) == _PREDICTION_KEYS
    assert body["student_id"] == student_id
    assert 0.0 <= body["placement_probability"] <= 1.0
    assert body["risk_level"] in {"low", "medium", "high"}


def test_prediction_uses_fallback_without_trained_model(client: TestClient) -> None:
    headers = _seed_student(client, email="pred2@example.com", register_number="21CSE401")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    body = client.post(
        f"/api/v1/predictions/students/{student_id}", headers=headers
    ).json()
    # With an empty MODEL_DIR the heuristic fallback must be used.
    assert body["model_version"] == "heuristic-v0"


def test_prediction_readiness_and_explanation_shapes(client: TestClient) -> None:
    headers = _seed_student(client, email="pred3@example.com", register_number="21CSE402")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    body = client.post(
        f"/api/v1/predictions/students/{student_id}", headers=headers
    ).json()

    readiness = body["readiness"]
    assert set(readiness.keys()) == {
        "academic",
        "technical",
        "communication",
        "industry",
        "overall",
    }
    for value in readiness.values():
        assert 0.0 <= value <= 100.0

    explanation = body["explanation"]
    assert set(explanation.keys()) == {"top_positive", "top_negative", "feature_importance"}
    assert len(explanation["top_positive"]) <= 5
    assert len(explanation["top_negative"]) <= 5
    for factor in explanation["feature_importance"]:
        assert {"feature", "label", "importance"} <= set(factor.keys())


def test_prediction_recommendations_and_careers(client: TestClient) -> None:
    headers = _seed_student(client, email="pred4@example.com", register_number="21CSE403")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    body = client.post(
        f"/api/v1/predictions/students/{student_id}", headers=headers
    ).json()

    assert isinstance(body["risk_reasons"], list)
    assert isinstance(body["recommendations"], list)
    for rec in body["recommendations"]:
        assert {"id", "category", "priority", "text"} <= set(rec.keys())
        assert rec["priority"] in {"high", "medium", "low"}

    careers = body["career_recommendations"]
    assert isinstance(careers, list)
    assert len(careers) <= 5
    for career in careers:
        assert {"role", "match_score", "reasons"} <= set(career.keys())
        assert 0.0 <= career["match_score"] <= 100.0

    skill_gaps = body["skill_gaps"]
    for gap in skill_gaps:
        assert {"skill", "current", "target", "gap", "severity"} <= set(gap.keys())
        assert gap["severity"] in {"high", "medium", "low"}


def test_latest_prediction_after_run(client: TestClient) -> None:
    headers = _seed_student(client, email="pred5@example.com", register_number="21CSE404")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    missing = client.get(f"/api/v1/predictions/students/{student_id}/latest", headers=headers)
    assert missing.status_code == 404, missing.text

    client.post(f"/api/v1/predictions/students/{student_id}", headers=headers)
    latest = client.get(f"/api/v1/predictions/students/{student_id}/latest", headers=headers)
    assert latest.status_code == 200, latest.text
    assert latest.json()["student_id"] == student_id


def test_prediction_history_records_entries(client: TestClient) -> None:
    headers = _seed_student(client, email="pred6@example.com", register_number="21CSE405")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    client.post(f"/api/v1/predictions/students/{student_id}", headers=headers)
    client.post(f"/api/v1/predictions/students/{student_id}", headers=headers)

    history = client.get(f"/api/v1/predictions/students/{student_id}/history", headers=headers)
    assert history.status_code == 200, history.text
    entries = history.json()
    assert isinstance(entries, list)
    assert len(entries) >= 2
    for entry in entries:
        assert {
            "id",
            "created_at",
            "placement_probability",
            "risk_level",
            "readiness_overall",
            "model_version",
        } <= set(entry.keys())


def test_student_cannot_predict_for_another_student(client: TestClient) -> None:
    headers_a = _seed_student(client, email="preda@example.com", register_number="21CSE406")
    headers_b = _seed_student(client, email="predb@example.com", register_number="21CSE407")
    other_id = client.get("/api/v1/students/me", headers=headers_b).json()["id"]

    response = client.post(f"/api/v1/predictions/students/{other_id}", headers=headers_a)
    assert response.status_code == 403, response.text


def test_faculty_can_predict_for_student(client: TestClient, db_session: Session) -> None:
    headers = _seed_student(client, email="predc@example.com", register_number="21CSE408")
    student_id = client.get("/api/v1/students/me", headers=headers).json()["id"]

    faculty_headers = make_login_for_role(
        client, db_session, role="faculty", email="predfac@example.com"
    )
    response = client.post(
        f"/api/v1/predictions/students/{student_id}", headers=faculty_headers
    )
    assert response.status_code == 200, response.text
