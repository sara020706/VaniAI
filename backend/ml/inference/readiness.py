"""Career-readiness scoring (CONTRACTS.md §6.3).

Pure, deterministic functions over a normalized feature dict. All outputs are
0-100 floats rounded to one decimal. No model, no I/O — safe to call anywhere.
"""

from __future__ import annotations

from ml.features.engineering import build_feature_row


def _clamp(value: float) -> float:
    return min(100.0, max(0.0, value))


def _capped_ratio(value: float, cap: float) -> float:
    """min(value, cap) / cap * 100 — a saturating 0-100 sub-score."""
    if cap <= 0:
        return 0.0
    return min(value, cap) / cap * 100.0


def compute_readiness(features: dict) -> dict[str, float]:
    """Compute the five readiness dimensions from a (possibly raw) feature dict.

    Keys returned: ``academic``, ``technical``, ``communication``,
    ``industry``, ``overall`` — each a 0-100 float rounded to 1 decimal.
    """
    f = build_feature_row(features)

    academic = (
        0.4 * (f["cgpa"] * 10.0)
        + 0.2 * f["tenth_percentage"]
        + 0.2 * f["twelfth_percentage"]
        + 0.2 * f["attendance_percentage"]
    )

    technical = (
        0.35 * f["coding_score"]
        + 0.25 * f["technical_skill_score"]
        + 0.2 * _capped_ratio(f["project_count"], 6.0)
        + 0.2 * _capped_ratio(f["certification_count"], 5.0)
    )

    communication = (
        0.5 * f["communication_score"]
        + 0.3 * f["mock_interview_score"]
        + 0.2 * f["leadership_score"]
    )

    industry = (
        0.35 * _capped_ratio(f["internship_count"], 3.0)
        + 0.2 * _capped_ratio(f["hackathon_count"], 5.0)
        + 0.3 * f["resume_score"]
        + 0.15 * f["aptitude_score"]
    )

    academic = _clamp(academic)
    technical = _clamp(technical)
    communication = _clamp(communication)
    industry = _clamp(industry)

    overall = _clamp(
        0.3 * academic + 0.3 * technical + 0.2 * communication + 0.2 * industry
    )

    return {
        "academic": round(academic, 1),
        "technical": round(technical, 1),
        "communication": round(communication, 1),
        "industry": round(industry, 1),
        "overall": round(overall, 1),
    }
