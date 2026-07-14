"""Feature engineering for the VaniAI placement model (CONTRACTS.md §6.1).

This module is the single source of truth for the model feature vector.
Training (M1), inference/explanations (M2), the backend services, and the
frontend label map all code against the names defined here — the column
names, their order, and the function signatures are binding:

- ``FEATURE_COLUMNS`` / ``TARGET_COLUMN`` / ``FEATURE_LABELS`` / ``ENGINEERED_COLUMNS``
- ``add_engineered_features(df)``
- ``build_feature_row(profile)`` / ``build_feature_frame(rows)``
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd

# --- Binding feature vector (exact names and order) ---------------------------

FEATURE_COLUMNS: list[str] = [
    "cgpa",
    "tenth_percentage",
    "twelfth_percentage",
    "attendance_percentage",
    "coding_score",
    "aptitude_score",
    "communication_score",
    "technical_skill_score",
    "leadership_score",
    "internship_count",
    "project_count",
    "certification_count",
    "hackathon_count",
    "resume_score",
    "mock_interview_score",
]

TARGET_COLUMN: str = "placed"  # 0/1

#: Derived columns appended after the base columns by ``add_engineered_features``.
ENGINEERED_COLUMNS: list[str] = ["academic_index", "skill_index", "experience_index"]

#: Columns the model actually trains on, in order (base + engineered).
MODEL_COLUMNS: list[str] = [*FEATURE_COLUMNS, *ENGINEERED_COLUMNS]

#: Human-readable labels used in SHAP explanations and mirrored by the
#: frontend in ``src/lib/constants.ts`` — keep both in sync.
FEATURE_LABELS: dict[str, str] = {
    "cgpa": "CGPA",
    "tenth_percentage": "10th Percentage",
    "twelfth_percentage": "12th Percentage",
    "attendance_percentage": "Attendance Percentage",
    "coding_score": "Coding Score",
    "aptitude_score": "Aptitude Score",
    "communication_score": "Communication Score",
    "technical_skill_score": "Technical Skill Score",
    "leadership_score": "Leadership Score",
    "internship_count": "Internship Count",
    "project_count": "Project Count",
    "certification_count": "Certification Count",
    "hackathon_count": "Hackathon Count",
    "resume_score": "Resume Score",
    "mock_interview_score": "Mock Interview Score",
    "academic_index": "Academic Index",
    "skill_index": "Skill Index",
    "experience_index": "Experience Index",
}

#: Count-style columns (non-negative integers, no upper bound).
COUNT_COLUMNS: list[str] = [
    "internship_count",
    "project_count",
    "certification_count",
    "hackathon_count",
]

_DEFAULT_CGPA: float = 6.0
_DEFAULT_SCORE: float = 50.0
_DEFAULT_COUNT: float = 0.0


def default_feature_value(column: str) -> float:
    """Sensible default for a missing feature value (counts 0, scores 50, cgpa 6)."""
    if column == "cgpa":
        return _DEFAULT_CGPA
    if column in COUNT_COLUMNS:
        return _DEFAULT_COUNT
    return _DEFAULT_SCORE


def feature_bounds(column: str) -> tuple[float, float | None]:
    """Valid ``(lower, upper)`` range for a base feature; ``None`` = unbounded."""
    if column == "cgpa":
        return (0.0, 10.0)
    if column in COUNT_COLUMNS:
        return (0.0, None)
    return (0.0, 100.0)


def build_feature_row(profile: dict[str, Any]) -> dict[str, float]:
    """Normalize a raw profile dict into the 15 base model features.

    Missing, ``None``, or non-numeric values fall back to sensible defaults
    (counts 0, scores 50.0, cgpa 6.0); values are clipped to their valid
    ranges and counts are rounded to whole numbers.
    """
    row: dict[str, float] = {}
    for column in FEATURE_COLUMNS:
        raw = profile.get(column)
        try:
            value = float(raw) if raw is not None else default_feature_value(column)
        except (TypeError, ValueError):
            value = default_feature_value(column)
        if not math.isfinite(value):
            value = default_feature_value(column)
        lower, upper = feature_bounds(column)
        value = max(lower, value) if upper is None else min(max(lower, value), upper)
        if column in COUNT_COLUMNS:
            value = float(int(round(value)))
        row[column] = value
    return row


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``df`` with the engineered columns appended.

    - ``academic_index``: mean of (cgpa*10, tenth, twelfth) — 0–100 scale.
    - ``skill_index``: mean of (coding, aptitude, technical) — 0–100 scale.
    - ``experience_index``: capped, weighted blend of internships (40),
      projects (30), certifications (15), hackathons (15) — 0–100 scale.
    """
    out = df.copy()
    out["academic_index"] = (
        out["cgpa"].astype(float) * 10.0
        + out["tenth_percentage"].astype(float)
        + out["twelfth_percentage"].astype(float)
    ) / 3.0
    out["skill_index"] = (
        out["coding_score"].astype(float)
        + out["aptitude_score"].astype(float)
        + out["technical_skill_score"].astype(float)
    ) / 3.0
    out["experience_index"] = (
        out["internship_count"].astype(float).clip(upper=3.0) / 3.0 * 40.0
        + out["project_count"].astype(float).clip(upper=6.0) / 6.0 * 30.0
        + out["certification_count"].astype(float).clip(upper=5.0) / 5.0 * 15.0
        + out["hackathon_count"].astype(float).clip(upper=5.0) / 5.0 * 15.0
    )
    return out


def build_feature_frame(rows: list[dict[str, Any]]) -> pd.DataFrame:
    """Build the model input frame (base + engineered columns, exact order).

    Each row is normalized through :func:`build_feature_row`, so partial or
    messy profile dicts are safe to pass straight from the API layer.
    """
    normalized = [build_feature_row(row) for row in rows]
    frame = pd.DataFrame(normalized, columns=FEATURE_COLUMNS).astype(float)
    frame = add_engineered_features(frame)
    return frame[MODEL_COLUMNS]
