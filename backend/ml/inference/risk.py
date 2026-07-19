"""Placement-risk classification (CONTRACTS.md §6.3).

Maps a placement probability plus supporting signals to a risk level and a
list of human-readable reasons. For low-risk students the reasons describe
strengths; otherwise they name the concrete weak signals driving the risk.
"""

from __future__ import annotations

from ml.features.engineering import build_feature_row

# Thresholds for the probability bands.
LOW_RISK_THRESHOLD: float = 0.70
MEDIUM_RISK_THRESHOLD: float = 0.40

# Weak-signal thresholds used to build reasons.
_CGPA_MIN = 6.5
_ATTENDANCE_MIN = 75.0
_CODING_MIN = 50.0
_COMMUNICATION_MIN = 50.0
_APTITUDE_MIN = 50.0
_RESUME_MIN = 60.0
_READINESS_MIN = 50.0


def classify_risk(
    probability: float,
    features: dict,
    readiness: dict,
) -> tuple[str, list[str]]:
    """Return ``(risk_level, reasons)``.

    ``risk_level`` is ``"low"`` (prob >= 0.70), ``"medium"`` (0.40-0.70), or
    ``"high"`` (< 0.40). ``reasons`` are human-readable strings — strengths for
    low risk, weak-signal explanations otherwise.
    """
    f = build_feature_row(features)
    overall_readiness = float(readiness.get("overall", 0.0))

    if probability >= LOW_RISK_THRESHOLD:
        level = "low"
    elif probability >= MEDIUM_RISK_THRESHOLD:
        level = "medium"
    else:
        level = "high"

    if level == "low":
        return level, _strength_reasons(f, overall_readiness, probability)

    return level, _weakness_reasons(f, overall_readiness)


def _weakness_reasons(f: dict, overall_readiness: float) -> list[str]:
    reasons: list[str] = []
    if f["cgpa"] < _CGPA_MIN:
        reasons.append(
            f"CGPA of {f['cgpa']:.2f} is below the {_CGPA_MIN:.1f} threshold many recruiters screen on."
        )
    if f["attendance_percentage"] < _ATTENDANCE_MIN:
        reasons.append(
            f"Attendance of {f['attendance_percentage']:.0f}% is below the {_ATTENDANCE_MIN:.0f}% eligibility bar."
        )
    if f["coding_score"] < _CODING_MIN:
        reasons.append(
            f"Coding score of {f['coding_score']:.0f} is low; technical rounds will be hard to clear."
        )
    if f["communication_score"] < _COMMUNICATION_MIN:
        reasons.append(
            f"Communication score of {f['communication_score']:.0f} may hurt HR and group-discussion rounds."
        )
    if f["aptitude_score"] < _APTITUDE_MIN:
        reasons.append(
            f"Aptitude score of {f['aptitude_score']:.0f} is below the level most placement tests demand."
        )
    if f["resume_score"] < _RESUME_MIN:
        reasons.append(
            f"Resume score of {f['resume_score']:.0f} suggests the profile is not yet ATS-ready."
        )
    if f["internship_count"] == 0:
        reasons.append("No internship experience yet, which limits industry exposure.")
    if overall_readiness < _READINESS_MIN:
        reasons.append(
            f"Overall career-readiness of {overall_readiness:.0f}/100 indicates broad preparation gaps."
        )
    if not reasons:
        reasons.append(
            "Placement probability is moderate; strengthen the strongest lever — coding, internships, or communication — to move up a band."
        )
    return reasons


def _strength_reasons(f: dict, overall_readiness: float, probability: float) -> list[str]:
    reasons: list[str] = [
        f"Strong placement probability of {probability * 100:.0f}% based on the current profile."
    ]
    if f["cgpa"] >= _CGPA_MIN:
        reasons.append(f"Solid CGPA of {f['cgpa']:.2f} clears most academic cut-offs.")
    if f["coding_score"] >= 70:
        reasons.append(f"Coding score of {f['coding_score']:.0f} is competitive for technical rounds.")
    if f["internship_count"] >= 1:
        reasons.append(
            f"{int(f['internship_count'])} internship(s) give demonstrable industry exposure."
        )
    if f["communication_score"] >= 70:
        reasons.append("Communication skills support interview and group-discussion performance.")
    if overall_readiness >= 70:
        reasons.append(f"Well-rounded readiness of {overall_readiness:.0f}/100 across all dimensions.")
    return reasons
