"""Career recommendation + skill-gap analysis (CONTRACTS.md §6.4).

- ``recommend_careers(features)`` -> top 5 role matches, each
  ``{"role", "match_score" (0-100), "reasons": [str]}`` sorted desc.
- ``identify_skill_gaps(features, readiness)`` -> list of
  ``{"skill", "current", "target", "gap", "severity"}`` for the areas below
  target (communication, coding, aptitude, resume, industry exposure).
"""

from __future__ import annotations

from typing import Any

from ml.features.engineering import build_feature_row

# Each role weights the normalized (0-1) feature signals that matter for it.
# Weights per role sum to 1.0 so match_score lands cleanly in 0-100.
_ROLE_PROFILES: dict[str, dict[str, float]] = {
    "Software Engineer": {
        "coding_score": 0.4,
        "technical_skill_score": 0.25,
        "project_count": 0.2,
        "aptitude_score": 0.15,
    },
    "Data Scientist": {
        "aptitude_score": 0.3,
        "coding_score": 0.25,
        "cgpa": 0.2,
        "technical_skill_score": 0.15,
        "certification_count": 0.1,
    },
    "ML Engineer": {
        "coding_score": 0.3,
        "technical_skill_score": 0.3,
        "aptitude_score": 0.2,
        "project_count": 0.2,
    },
    "Cloud Engineer": {
        "technical_skill_score": 0.3,
        "certification_count": 0.3,
        "coding_score": 0.2,
        "project_count": 0.2,
    },
    "Business Analyst": {
        "communication_score": 0.35,
        "aptitude_score": 0.3,
        "leadership_score": 0.2,
        "cgpa": 0.15,
    },
    "Cyber Security Analyst": {
        "technical_skill_score": 0.3,
        "aptitude_score": 0.25,
        "coding_score": 0.25,
        "certification_count": 0.2,
    },
    "Data Engineer": {
        "coding_score": 0.3,
        "technical_skill_score": 0.3,
        "project_count": 0.2,
        "cgpa": 0.2,
    },
}

# Normalization caps for count-style features.
_COUNT_CAPS = {
    "internship_count": 3.0,
    "project_count": 6.0,
    "certification_count": 5.0,
    "hackathon_count": 5.0,
}


def _norm(feature: str, value: float) -> float:
    if feature == "cgpa":
        return max(0.0, min(1.0, value / 10.0))
    if feature in _COUNT_CAPS:
        return max(0.0, min(1.0, value / _COUNT_CAPS[feature]))
    return max(0.0, min(1.0, value / 100.0))


def _reasons_for(role: str, f: dict, weights: dict[str, float]) -> list[str]:
    """Name the two or three strongest contributing signals for the role."""
    from ml.features.engineering import FEATURE_LABELS

    contributions = sorted(
        ((feat, w * _norm(feat, f[feat])) for feat, w in weights.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )
    reasons: list[str] = []
    for feat, _ in contributions[:3]:
        label = FEATURE_LABELS.get(feat, feat.replace("_", " ").title())
        value = f[feat]
        if feat in _COUNT_CAPS:
            reasons.append(f"{int(value)} {label.lower()} support this path.")
        elif feat == "cgpa":
            reasons.append(f"CGPA of {value:.2f} fits the academic bar for this role.")
        else:
            reasons.append(f"{label} of {value:.0f} aligns with this role's demands.")
    return reasons


def recommend_careers(features: dict) -> list[dict[str, Any]]:
    """Return the top 5 role matches, best first."""
    f = build_feature_row(features)
    scored: list[dict[str, Any]] = []
    for role, weights in _ROLE_PROFILES.items():
        score = sum(w * _norm(feat, f[feat]) for feat, w in weights.items()) * 100.0
        scored.append({
            "role": role,
            "match_score": round(max(0.0, min(100.0, score)), 1),
            "reasons": _reasons_for(role, f, weights),
        })
    scored.sort(key=lambda item: item["match_score"], reverse=True)
    return scored[:5]


# --- Skill-gap analysis -------------------------------------------------------

_SKILL_TARGETS: dict[str, float] = {
    "communication": 70.0,
    "coding": 70.0,
    "aptitude": 70.0,
    "resume": 60.0,
}
_INDUSTRY_TARGET = 60.0


def _severity(gap: float) -> str:
    if gap >= 25:
        return "high"
    if gap >= 10:
        return "medium"
    return "low"


def identify_skill_gaps(features: dict, readiness: dict) -> list[dict[str, Any]]:
    """Return skill gaps for areas below their target, worst first."""
    f = build_feature_row(features)
    current_map = {
        "communication": f["communication_score"],
        "coding": f["coding_score"],
        "aptitude": f["aptitude_score"],
        "resume": f["resume_score"],
    }

    gaps: list[dict[str, Any]] = []
    for skill, target in _SKILL_TARGETS.items():
        current = float(current_map[skill])
        if current < target:
            gap = round(target - current, 1)
            gaps.append({
                "skill": skill,
                "current": round(current, 1),
                "target": target,
                "gap": gap,
                "severity": _severity(gap),
            })

    industry = float(readiness.get("industry", 0.0))
    if industry < _INDUSTRY_TARGET:
        gap = round(_INDUSTRY_TARGET - industry, 1)
        gaps.append({
            "skill": "industry exposure",
            "current": round(industry, 1),
            "target": _INDUSTRY_TARGET,
            "gap": gap,
            "severity": _severity(gap),
        })

    gaps.sort(key=lambda item: item["gap"], reverse=True)
    return gaps
