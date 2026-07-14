"""Unit tests for the standalone ML package (no DB, network, or trained model).

Covers the readiness formulas, risk banding, the career recommender, the
stdlib-only dataset generator, and ``build_feature_row`` defaulting — all pure
functions defined by CONTRACTS.md section 6.
"""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from ml.data.generate_dataset import generate
from ml.features.engineering import (
    ENGINEERED_COLUMNS,
    FEATURE_COLUMNS,
    MODEL_COLUMNS,
    TARGET_COLUMN,
    build_feature_frame,
    build_feature_row,
)
from ml.inference.readiness import compute_readiness
from ml.inference.risk import classify_risk
from ml.recommendation.career import recommend_careers

# A fully-specified, high-signal profile used across several tests.
STRONG_PROFILE: dict[str, float] = {
    "cgpa": 9.0,
    "tenth_percentage": 90.0,
    "twelfth_percentage": 88.0,
    "attendance_percentage": 92.0,
    "coding_score": 85.0,
    "aptitude_score": 80.0,
    "communication_score": 82.0,
    "technical_skill_score": 84.0,
    "leadership_score": 78.0,
    "internship_count": 3,
    "project_count": 6,
    "certification_count": 5,
    "hackathon_count": 4,
    "resume_score": 88.0,
    "mock_interview_score": 86.0,
}

WEAK_PROFILE: dict[str, float] = {
    "cgpa": 5.2,
    "tenth_percentage": 55.0,
    "twelfth_percentage": 52.0,
    "attendance_percentage": 60.0,
    "coding_score": 35.0,
    "aptitude_score": 40.0,
    "communication_score": 38.0,
    "technical_skill_score": 42.0,
    "leadership_score": 30.0,
    "internship_count": 0,
    "project_count": 0,
    "certification_count": 0,
    "hackathon_count": 0,
    "resume_score": 45.0,
    "mock_interview_score": 40.0,
}


# --- build_feature_row defaults -----------------------------------------------------


def test_build_feature_row_applies_defaults_for_missing_values() -> None:
    row = build_feature_row({})
    assert row["cgpa"] == pytest.approx(6.0)
    for column in ("internship_count", "project_count", "certification_count", "hackathon_count"):
        assert row[column] == pytest.approx(0.0)
    for score in ("coding_score", "aptitude_score", "communication_score", "resume_score"):
        assert row[score] == pytest.approx(50.0)
    assert set(row.keys()) == set(FEATURE_COLUMNS)


def test_build_feature_row_clips_out_of_range_values() -> None:
    row = build_feature_row({"cgpa": 42.0, "coding_score": -20.0, "attendance_percentage": 250.0})
    assert row["cgpa"] == pytest.approx(10.0)
    assert row["coding_score"] == pytest.approx(0.0)
    assert row["attendance_percentage"] == pytest.approx(100.0)


def test_build_feature_row_rounds_counts_to_integers() -> None:
    row = build_feature_row({"internship_count": 2.7, "project_count": 3.2})
    assert row["internship_count"] == pytest.approx(3.0)
    assert row["project_count"] == pytest.approx(3.0)


def test_build_feature_frame_has_model_columns_in_order() -> None:
    frame = build_feature_frame([STRONG_PROFILE, WEAK_PROFILE])
    assert list(frame.columns) == MODEL_COLUMNS
    assert len(frame) == 2
    for column in ENGINEERED_COLUMNS:
        assert column in frame.columns


# --- Readiness formulas -------------------------------------------------------------


def test_compute_readiness_keys_and_bounds() -> None:
    readiness = compute_readiness(STRONG_PROFILE)
    assert set(readiness.keys()) == {
        "academic",
        "technical",
        "communication",
        "industry",
        "overall",
    }
    for value in readiness.values():
        assert 0.0 <= value <= 100.0


def test_compute_readiness_academic_formula() -> None:
    """academic = 0.4*(cgpa*10) + 0.2*tenth + 0.2*twelfth + 0.2*attendance."""
    readiness = compute_readiness(STRONG_PROFILE)
    expected = (
        0.4 * (STRONG_PROFILE["cgpa"] * 10.0)
        + 0.2 * STRONG_PROFILE["tenth_percentage"]
        + 0.2 * STRONG_PROFILE["twelfth_percentage"]
        + 0.2 * STRONG_PROFILE["attendance_percentage"]
    )
    assert readiness["academic"] == pytest.approx(round(expected, 1), abs=0.11)


def test_compute_readiness_communication_formula() -> None:
    """communication = 0.5*communication + 0.3*mock_interview + 0.2*leadership."""
    readiness = compute_readiness(STRONG_PROFILE)
    expected = (
        0.5 * STRONG_PROFILE["communication_score"]
        + 0.3 * STRONG_PROFILE["mock_interview_score"]
        + 0.2 * STRONG_PROFILE["leadership_score"]
    )
    assert readiness["communication"] == pytest.approx(round(expected, 1), abs=0.11)


def test_compute_readiness_strong_beats_weak() -> None:
    strong = compute_readiness(STRONG_PROFILE)
    weak = compute_readiness(WEAK_PROFILE)
    assert strong["overall"] > weak["overall"]


# --- Risk banding -------------------------------------------------------------------


def test_classify_risk_low_band() -> None:
    readiness = compute_readiness(STRONG_PROFILE)
    level, reasons = classify_risk(0.85, STRONG_PROFILE, readiness)
    assert level == "low"
    assert isinstance(reasons, list)
    assert reasons  # low risk returns strengths-based reasons, never empty


def test_classify_risk_medium_band() -> None:
    readiness = compute_readiness(STRONG_PROFILE)
    level, _ = classify_risk(0.55, STRONG_PROFILE, readiness)
    assert level == "medium"


def test_classify_risk_high_band_lists_weaknesses() -> None:
    readiness = compute_readiness(WEAK_PROFILE)
    level, reasons = classify_risk(0.25, WEAK_PROFILE, readiness)
    assert level == "high"
    assert isinstance(reasons, list)
    assert reasons  # weak signals must produce human-readable reasons


def test_classify_risk_boundaries() -> None:
    readiness = compute_readiness(STRONG_PROFILE)
    # >= 0.70 => low ; 0.40-0.70 => medium ; < 0.40 => high
    assert classify_risk(0.70, STRONG_PROFILE, readiness)[0] == "low"
    assert classify_risk(0.40, STRONG_PROFILE, readiness)[0] == "medium"
    assert classify_risk(0.399, WEAK_PROFILE, compute_readiness(WEAK_PROFILE))[0] == "high"


# --- Career recommender -------------------------------------------------------------


def test_recommend_careers_shape_and_ordering() -> None:
    careers = recommend_careers(STRONG_PROFILE)
    assert isinstance(careers, list)
    assert 1 <= len(careers) <= 5
    scores = [career["match_score"] for career in careers]
    assert scores == sorted(scores, reverse=True)
    for career in careers:
        assert {"role", "match_score", "reasons"} <= set(career.keys())
        assert 0.0 <= career["match_score"] <= 100.0
        assert isinstance(career["reasons"], list)


# --- Dataset generator --------------------------------------------------------------


def test_generate_dataset_writes_valid_csv(tmp_path: Path) -> None:
    out_path = tmp_path / "generated.csv"
    generate(rows=200, out=str(out_path))
    assert out_path.exists()

    with out_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        rows = list(reader)

    # Every model feature column, the target, and register metadata must be present.
    for column in [*FEATURE_COLUMNS, TARGET_COLUMN, "register_number", "name", "department", "batch"]:
        assert column in header, f"missing column: {column}"

    assert len(rows) == 200
    # Target is strictly 0/1.
    for row in rows:
        assert row[TARGET_COLUMN] in {"0", "1"}


def test_generate_dataset_has_both_classes(tmp_path: Path) -> None:
    out_path = tmp_path / "balanced.csv"
    generate(rows=500, out=str(out_path))
    with out_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        labels = {row["placed"] for row in reader}
    # A realistic generator (~55% placed) must produce both classes.
    assert labels == {"0", "1"}
