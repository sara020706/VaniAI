"""Resume analysis and scoring (CONTRACTS.md §6.5).

``analyze_resume(file_path)`` returns::

    {
      "resume_score": 0-100, "ats_score": 0-100,
      "extracted": {"skills": [...], "projects": [...], "experience": [...], "education": [...]},
      "missing_sections": [...], "suggestions": [...], "word_count": int,
    }

Scoring: section coverage 40% + skill breadth 30% + quantified achievements /
action verbs 15% + length/format 15%. Never raises — an unreadable, empty, or
image-only PDF yields a low score plus actionable suggestions.
"""

from __future__ import annotations

import re
from typing import Any

from ml.resume.parser import extract_text, has_contact_info, parse_sections

# --- Skill taxonomy ----------------------------------------------------------

_SKILL_TAXONOMY: dict[str, tuple[str, ...]] = {
    "languages": (
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
        "kotlin", "swift", "ruby", "php", "scala", "r", "sql", "bash",
    ),
    "frameworks": (
        "react", "angular", "vue", "node", "express", "django", "flask",
        "fastapi", "spring", "next.js", "tailwind", "pytorch", "tensorflow",
        "scikit-learn", "pandas", "numpy",
    ),
    "cloud": (
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins",
        "ci/cd", "lambda", "s3", "ec2",
    ),
    "data": (
        "postgresql", "mysql", "mongodb", "redis", "kafka", "spark", "hadoop",
        "airflow", "snowflake", "tableau", "power bi", "etl",
    ),
    "tools": ("git", "github", "gitlab", "jira", "figma", "linux", "postman"),
    "soft": (
        "leadership", "communication", "teamwork", "problem solving",
        "collaboration", "mentoring", "presentation",
    ),
}
_ALL_SKILLS = {skill for group in _SKILL_TAXONOMY.values() for skill in group}

_REQUIRED_SECTIONS = ("contact", "skills", "projects", "experience", "education")
_ACTION_VERBS = (
    "built", "developed", "designed", "implemented", "led", "created",
    "improved", "optimized", "reduced", "increased", "launched", "managed",
    "architected", "automated", "delivered", "engineered",
)
_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?%?\b")
_BULLET_RE = re.compile(r"(?m)^\s*[-•*]\s+(.+)$")


def _detect_skills(text: str) -> list[str]:
    lowered = text.lower()
    found = [skill for skill in _ALL_SKILLS if skill in lowered]
    return sorted(found)


def _extract_bullets(text: str, keywords: tuple[str, ...], limit: int = 8) -> list[str]:
    """Pull bullet-like lines that mention any of the section keywords."""
    lowered_keywords = tuple(k.lower() for k in keywords)
    results: list[str] = []
    for match in _BULLET_RE.finditer(text):
        line = match.group(1).strip()
        if any(k in line.lower() for k in lowered_keywords):
            results.append(line[:200])
        if len(results) >= limit:
            break
    return results


def _extract_lines_near(text: str, headings: tuple[str, ...], limit: int = 6) -> list[str]:
    """Grab non-empty lines following a matching section heading."""
    lines = [ln.strip() for ln in text.splitlines()]
    collected: list[str] = []
    capture = False
    for line in lines:
        low = line.lower()
        if any(h in low for h in headings) and len(line) < 60:
            capture = True
            continue
        if capture:
            if not line:
                if collected:
                    break
                continue
            if len(line) < 60 and line.isupper():  # next heading
                break
            collected.append(line[:200])
            if len(collected) >= limit:
                break
    return collected


def analyze_resume(file_path: str) -> dict[str, Any]:
    """Analyze a resume PDF and return the scored contract dict."""
    text = extract_text(file_path)
    word_count = len(text.split())

    if word_count < 20:
        # Unreadable / empty / image-only.
        return {
            "resume_score": 10.0,
            "ats_score": 15.0,
            "extracted": {"skills": [], "projects": [], "experience": [], "education": []},
            "missing_sections": list(_REQUIRED_SECTIONS),
            "suggestions": [
                "The resume could not be read as text — export it as a text-based PDF (not a scanned image).",
                "Use standard section headings: Summary, Skills, Projects, Experience, Education.",
                "Include contact details: email, phone, and LinkedIn/GitHub links.",
            ],
            "word_count": word_count,
        }

    sections = parse_sections(text)
    skills = _detect_skills(text)
    contact = has_contact_info(text)

    extracted = {
        "skills": skills,
        "projects": _extract_bullets(text, ("project", "built", "developed", "app"))
        or _extract_lines_near(text, ("projects",)),
        "experience": _extract_bullets(text, ("intern", "engineer", "developer", "worked"))
        or _extract_lines_near(text, ("experience", "employment")),
        "education": _extract_lines_near(text, ("education", "b.tech", "degree", "university")),
    }

    missing_sections = [s for s in _REQUIRED_SECTIONS if not sections.get(s, False)]

    # --- Scoring components ---
    coverage = sum(1 for s in _REQUIRED_SECTIONS if sections.get(s, False)) / len(_REQUIRED_SECTIONS)
    coverage_score = coverage * 40.0

    skill_breadth = min(len(skills), 15) / 15.0
    skill_score = skill_breadth * 30.0

    lowered = text.lower()
    verb_hits = sum(1 for v in _ACTION_VERBS if v in lowered)
    number_hits = len(_NUMBER_RE.findall(text))
    impact = min(1.0, (verb_hits / 8.0) * 0.6 + (min(number_hits, 10) / 10.0) * 0.4)
    impact_score = impact * 15.0

    length_ok = 1.0 if 250 <= word_count <= 900 else (0.6 if word_count < 250 else 0.75)
    format_score = length_ok * 15.0

    resume_score = round(coverage_score + skill_score + impact_score + format_score, 1)

    # --- ATS score ---
    ats = 0.0
    ats += 35.0 if word_count >= 150 else 15.0  # text extractability
    standard_headers = sum(1 for s in _REQUIRED_SECTIONS if sections.get(s, False))
    ats += (standard_headers / len(_REQUIRED_SECTIONS)) * 30.0
    ats += 20.0 * (sum(contact.values()) / 3.0)
    ats += 15.0 if 250 <= word_count <= 1000 else 7.0
    ats_score = round(min(100.0, ats), 1)

    suggestions = _build_suggestions(missing_sections, skills, impact, contact, word_count)

    return {
        "resume_score": min(100.0, resume_score),
        "ats_score": ats_score,
        "extracted": extracted,
        "missing_sections": missing_sections,
        "suggestions": suggestions,
        "word_count": word_count,
    }


def _build_suggestions(
    missing_sections: list[str],
    skills: list[str],
    impact: float,
    contact: dict[str, bool],
    word_count: int,
) -> list[str]:
    suggestions: list[str] = []
    for section in missing_sections:
        suggestions.append(f"Add a clear '{section.title()}' section — recruiters and ATS parsers look for it.")
    if len(skills) < 6:
        suggestions.append("List more concrete technical skills (languages, frameworks, cloud, and databases).")
    if impact < 0.5:
        suggestions.append("Quantify achievements with numbers and lead bullets with strong action verbs (built, led, optimized).")
    if not contact.get("links"):
        suggestions.append("Add LinkedIn and GitHub links so recruiters can explore your work.")
    if word_count < 250:
        suggestions.append("The resume is short — expand project and experience bullets with specifics.")
    elif word_count > 900:
        suggestions.append("The resume is long — tighten it toward one page of the most relevant content.")
    if not suggestions:
        suggestions.append("Strong resume — keep it current and tailor keywords to each target role.")
    return suggestions
