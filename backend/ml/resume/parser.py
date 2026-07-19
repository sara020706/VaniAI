"""Resume PDF text extraction and section parsing (CONTRACTS.md §6.5).

``extract_text(file_path)`` reads a PDF with pypdf and returns plain text
(empty string on any failure — never raises). ``parse_sections(text)`` detects
common resume sections by heading keywords and returns a bool-per-section map.
"""

from __future__ import annotations

import re

# Section name -> heading keywords that signal its presence.
_SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "contact": ("email", "phone", "linkedin", "github", "@"),
    "summary": ("summary", "objective", "profile", "about me"),
    "skills": ("skills", "technical skills", "technologies", "tech stack"),
    "projects": ("projects", "project work", "personal projects"),
    "experience": ("experience", "employment", "work history", "internship"),
    "education": ("education", "academic", "qualification", "b.tech", "b.e.", "degree"),
    "certifications": ("certification", "certificate", "licenses", "courses"),
    "achievements": ("achievement", "award", "honor", "accomplishment"),
}

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s-]{8,}\d)")


def extract_text(file_path: str) -> str:
    """Extract text from a PDF; returns "" on any error (encrypted, image-only…)."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:  # noqa: BLE001
                return ""
        parts: list[str] = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:  # noqa: BLE001 - skip unreadable page
                continue
        return "\n".join(parts).strip()
    except Exception:  # noqa: BLE001 - malformed/missing file
        return ""


def parse_sections(text: str) -> dict[str, bool]:
    """Return a {section: present} map based on heading keyword detection."""
    lowered = text.lower()
    sections: dict[str, bool] = {}
    for section, keywords in _SECTION_KEYWORDS.items():
        if section == "contact":
            sections[section] = bool(_EMAIL_RE.search(text) or _PHONE_RE.search(text))
        else:
            sections[section] = any(keyword in lowered for keyword in keywords)
    return sections


def has_contact_info(text: str) -> dict[str, bool]:
    """Fine-grained contact detection used by the ATS score."""
    return {
        "email": bool(_EMAIL_RE.search(text)),
        "phone": bool(_PHONE_RE.search(text)),
        "links": ("linkedin" in text.lower() or "github" in text.lower()),
    }
