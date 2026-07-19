"""Personalized recommendation engine (CONTRACTS.md §6.4).

``generate_recommendations(features, readiness, probability, explanation)``
returns 4-8 dynamic, prioritized recommendation dicts keyed off the student's
weakest areas and the top negative SHAP factors of the current prediction.

Each item: ``{"category", "priority", "text"}`` with
category in {coding, aptitude, communication, resume, academics, experience,
certification, interview} and priority in {high, medium, low}.
"""

from __future__ import annotations

from typing import Any

from ml.features.engineering import build_feature_row

_MIN_RECOMMENDATIONS = 4
_MAX_RECOMMENDATIONS = 8


def _priority_for(deficit: float) -> str:
    """Map a 0-100 deficit to a priority band."""
    if deficit >= 30:
        return "high"
    if deficit >= 15:
        return "medium"
    return "low"


def _rank_key(item: dict[str, Any]) -> int:
    return {"high": 0, "medium": 1, "low": 2}[item["priority"]]


def generate_recommendations(
    features: dict,
    readiness: dict,
    probability: float,
    explanation: dict | None = None,
) -> list[dict[str, Any]]:
    """Produce 4-8 prioritized, actionable recommendations."""
    f = build_feature_row(features)
    candidates: list[dict[str, Any]] = []

    # --- Skill-driven rules (deficit vs. a 70 target) ---
    if f["coding_score"] < 70:
        candidates.append({
            "category": "coding",
            "priority": _priority_for(70 - f["coding_score"]),
            "text": "Build one full-stack application end to end and solve 3-4 DSA problems daily to lift your coding score.",
        })
    if f["aptitude_score"] < 70:
        candidates.append({
            "category": "aptitude",
            "priority": _priority_for(70 - f["aptitude_score"]),
            "text": "Improve aptitude with 30 minutes of daily quantitative and logical-reasoning practice.",
        })
    if f["communication_score"] < 70:
        candidates.append({
            "category": "communication",
            "priority": _priority_for(70 - f["communication_score"]),
            "text": "Improve communication through weekly mock presentations and group discussions.",
        })
    if f["resume_score"] < 60:
        candidates.append({
            "category": "resume",
            "priority": _priority_for(60 - f["resume_score"] + 10),
            "text": "Rework your resume with quantified achievements and standard ATS-friendly sections.",
        })
    if f["cgpa"] < 6.5:
        candidates.append({
            "category": "academics",
            "priority": _priority_for((6.5 - f["cgpa"]) * 15),
            "text": "Focus on core subjects next semester to raise your CGPA above the 6.5 recruiter cut-off.",
        })
    if f["internship_count"] == 0:
        candidates.append({
            "category": "experience",
            "priority": "high",
            "text": "Secure at least one internship — even a remote or open-source stint — to gain industry exposure.",
        })
    elif f["project_count"] < 3:
        candidates.append({
            "category": "experience",
            "priority": "medium",
            "text": "Ship two more substantial projects and publish them on GitHub with clear READMEs.",
        })
    if f["certification_count"] < 2:
        candidates.append({
            "category": "certification",
            "priority": "medium",
            "text": "Complete the AWS Cloud Practitioner certification to validate cloud fundamentals.",
        })
    if f["hackathon_count"] == 0:
        candidates.append({
            "category": "experience",
            "priority": "low",
            "text": "Participate in coding contests and hackathons to sharpen problem-solving under time pressure.",
        })
    if f["mock_interview_score"] < 65:
        candidates.append({
            "category": "interview",
            "priority": _priority_for(65 - f["mock_interview_score"]),
            "text": "Schedule regular mock interviews to build fluency and confidence for placement rounds.",
        })

    # --- Boost priority for categories flagged by top-negative SHAP factors ---
    negative_features = _negative_categories(explanation)
    for item in candidates:
        if item["category"] in negative_features and item["priority"] != "high":
            item["priority"] = "high" if item["priority"] == "medium" else "medium"

    # --- Ensure a healthy minimum with strengthening advice ---
    if len(candidates) < _MIN_RECOMMENDATIONS:
        _add_growth_fillers(candidates, f, probability)

    candidates.sort(key=_rank_key)
    return candidates[:_MAX_RECOMMENDATIONS]


_FEATURE_TO_CATEGORY = {
    "coding_score": "coding",
    "aptitude_score": "aptitude",
    "communication_score": "communication",
    "resume_score": "resume",
    "cgpa": "academics",
    "internship_count": "experience",
    "project_count": "experience",
    "certification_count": "certification",
    "mock_interview_score": "interview",
}


def _negative_categories(explanation: dict | None) -> set[str]:
    if not explanation:
        return set()
    cats: set[str] = set()
    for factor in explanation.get("top_negative", []):
        feature = factor.get("feature")
        if feature in _FEATURE_TO_CATEGORY:
            cats.add(_FEATURE_TO_CATEGORY[feature])
    return cats


def _add_growth_fillers(candidates: list[dict[str, Any]], f: dict, probability: float) -> None:
    fillers = [
        {
            "category": "interview",
            "priority": "low",
            "text": "Keep practicing mock interviews to convert a strong profile into confident offers.",
        },
        {
            "category": "certification",
            "priority": "low",
            "text": "Add a specialization certification (data, cloud, or security) aligned with your target role.",
        },
        {
            "category": "communication",
            "priority": "low",
            "text": "Lead a study group or tech talk to further sharpen communication and leadership.",
        },
        {
            "category": "experience",
            "priority": "low",
            "text": "Contribute to an open-source project to deepen real-world engineering experience.",
        },
    ]
    existing = {(c["category"], c["text"]) for c in candidates}
    for filler in fillers:
        if len(candidates) >= _MIN_RECOMMENDATIONS:
            break
        if (filler["category"], filler["text"]) not in existing:
            candidates.append(filler)
