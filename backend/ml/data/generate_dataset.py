"""Synthetic placement dataset generator (CONTRACTS.md §6.1 / §6.2).

**Standard library only** — ``random``, ``csv``, ``math``, ``argparse``. This
module must run on a bare Python installation (no numpy / pandas / sklearn) so
that it can be invoked as a lightweight data-preparation step:

    python -m ml.data.generate_dataset --rows 2000 --out ../data/sample_students.csv

The generator produces *realistically correlated* data: a per-student latent
"aptitude" factor drives CGPA, coding, aptitude and the other academic/skill
signals, experience counts scale with that factor, and the placement label is
drawn from a logistic model over a weighted blend of the (standardized)
features plus noise. Parameters are tuned so that roughly 55% of students are
placed.

Column order written to the CSV::

    register_number, name, department, batch,
    <FEATURE_COLUMNS...>, placed

``FEATURE_COLUMNS`` are imported from :mod:`ml.features.engineering` so this
file never drifts from the binding feature vector. That import pulls in pandas
transitively; to honour the stdlib-only contract for the *generation logic*
itself we import the column names lazily and fall back to a hard-coded copy of
the exact same list if the features module (or pandas) is unavailable.
"""

from __future__ import annotations

import argparse
import csv
import math
import random

# ---------------------------------------------------------------------------
# Feature column names. Prefer the single source of truth in
# ``ml.features.engineering``; fall back to an identical hard-coded list so the
# generator still runs on an installation without pandas.
# ---------------------------------------------------------------------------
try:  # pragma: no cover - exercised implicitly depending on environment
    from ml.features.engineering import FEATURE_COLUMNS as _FEATURE_COLUMNS
    from ml.features.engineering import TARGET_COLUMN as _TARGET_COLUMN

    FEATURE_COLUMNS: list[str] = list(_FEATURE_COLUMNS)
    TARGET_COLUMN: str = _TARGET_COLUMN
except Exception:  # pragma: no cover - stdlib-only fallback
    FEATURE_COLUMNS = [
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
    TARGET_COLUMN = "placed"


#: Metadata columns written before the feature columns.
META_COLUMNS: list[str] = ["register_number", "name", "department", "batch"]

#: Full CSV header in write order.
CSV_HEADER: list[str] = [*META_COLUMNS, *FEATURE_COLUMNS, TARGET_COLUMN]

DEPARTMENTS: list[str] = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]
BATCHES: list[str] = ["2024", "2025", "2026", "2027"]

#: Intercept of the logistic placement model. Calibrated so the overall placed
#: rate is ~55% given the feature distribution produced by ``_make_student``.
_PLACEMENT_INTERCEPT: float = -1.42

_FIRST_NAMES: list[str] = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
    "Ishaan", "Rohan", "Ananya", "Diya", "Aadhya", "Saanvi", "Ira", "Myra",
    "Anika", "Navya", "Kiara", "Riya", "Karthik", "Nikhil", "Rahul", "Varun",
    "Harish", "Deepak", "Manoj", "Suresh", "Priya", "Divya", "Meena", "Kavya",
    "Lakshmi", "Sneha", "Pooja", "Nandini", "Fatima", "Zoya", "Ayaan", "Imran",
]
_LAST_NAMES: list[str] = [
    "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Rao", "Menon", "Pillai",
    "Gupta", "Kumar", "Singh", "Das", "Bose", "Chowdhury", "Patel", "Shah",
    "Naidu", "Krishnan", "Subramanian", "Bhat", "Joshi", "Kulkarni", "Desai",
    "Mehta", "Agarwal", "Khan", "Sheikh", "Fernandes", "Dsouza", "Thomas",
]


def _clip(value: float, lower: float, upper: float) -> float:
    """Clamp ``value`` into the inclusive ``[lower, upper]`` range."""
    return max(lower, min(upper, value))


def _logistic(x: float) -> float:
    """Numerically stable logistic sigmoid."""
    if x >= 0.0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _make_student(rng: random.Random, index: int) -> dict[str, object]:
    """Generate one correlated synthetic student record (features + label)."""
    # Latent aptitude factor in roughly [-1, 1]; drives every other signal.
    latent = _clip(rng.gauss(0.0, 1.0), -2.5, 2.5) / 2.5

    def signal(center: float, spread: float, weight: float) -> float:
        """A 0–100 signal centred on ``center`` and pulled by the latent factor."""
        base = center + weight * latent * spread
        noisy = base + rng.gauss(0.0, spread * 0.45)
        return noisy

    # --- Academic signals -------------------------------------------------
    cgpa = _clip(6.8 + 1.9 * latent + rng.gauss(0.0, 0.55), 4.0, 10.0)
    tenth = _clip(signal(78.0, 12.0, 0.8), 45.0, 100.0)
    twelfth = _clip(signal(76.0, 13.0, 0.8), 45.0, 100.0)
    attendance = _clip(signal(82.0, 10.0, 0.6), 50.0, 100.0)

    # --- Skill signals ----------------------------------------------------
    coding = _clip(signal(62.0, 20.0, 1.0), 5.0, 100.0)
    aptitude = _clip(signal(64.0, 18.0, 0.9), 5.0, 100.0)
    communication = _clip(signal(63.0, 17.0, 0.7), 10.0, 100.0)
    technical = _clip(signal(61.0, 19.0, 1.0), 5.0, 100.0)
    leadership = _clip(signal(58.0, 18.0, 0.55), 5.0, 100.0)

    # --- Experience counts (scale with latent factor, Poisson-ish) --------
    def count(base_lambda: float, weight: float, cap: int) -> int:
        lam = max(0.0, base_lambda + weight * latent)
        draws = 0
        # Knuth-style Poisson sampling using stdlib random only.
        limit = math.exp(-lam)
        product = rng.random()
        while product > limit:
            draws += 1
            product *= rng.random()
            if draws >= cap:
                break
        return min(draws, cap)

    internships = count(0.9, 0.9, 5)
    projects = count(2.2, 1.4, 10)
    certifications = count(1.6, 1.1, 8)
    hackathons = count(1.0, 1.0, 6)

    # --- Professional signals --------------------------------------------
    resume = _clip(
        50.0
        + 22.0 * latent
        + 3.5 * min(projects, 6)
        + 2.5 * min(internships, 3)
        + rng.gauss(0.0, 8.0),
        10.0,
        100.0,
    )
    mock_interview = _clip(
        0.55 * communication + 0.3 * aptitude + 8.0 * latent + rng.gauss(0.0, 9.0),
        5.0,
        100.0,
    )

    features: dict[str, float] = {
        "cgpa": round(cgpa, 2),
        "tenth_percentage": round(tenth, 1),
        "twelfth_percentage": round(twelfth, 1),
        "attendance_percentage": round(attendance, 1),
        "coding_score": round(coding, 1),
        "aptitude_score": round(aptitude, 1),
        "communication_score": round(communication, 1),
        "technical_skill_score": round(technical, 1),
        "leadership_score": round(leadership, 1),
        "internship_count": float(internships),
        "project_count": float(projects),
        "certification_count": float(certifications),
        "hackathon_count": float(hackathons),
        "resume_score": round(resume, 1),
        "mock_interview_score": round(mock_interview, 1),
    }

    # --- Placement label via logistic over standardized weighted features -
    # Standardize each driver to ~[-1, 1] around a plausible mean, then take a
    # weighted sum. The intercept is tuned so the overall placed rate ~= 55%.
    logit = (
        _PLACEMENT_INTERCEPT
        + 1.35 * ((cgpa - 6.5) / 2.0)
        + 1.15 * ((coding - 60.0) / 25.0)
        + 0.85 * ((aptitude - 60.0) / 25.0)
        + 0.70 * ((communication - 60.0) / 25.0)
        + 0.65 * ((technical - 60.0) / 25.0)
        + 0.45 * ((resume - 60.0) / 25.0)
        + 0.40 * ((mock_interview - 60.0) / 25.0)
        + 0.35 * ((attendance - 80.0) / 15.0)
        + 0.55 * min(internships, 3)
        + 0.22 * min(projects, 6)
        + 0.18 * min(certifications, 5)
        + 0.15 * min(hackathons, 5)
        + rng.gauss(0.0, 0.65)  # irreducible noise
    )
    probability = _logistic(logit)
    placed = 1 if rng.random() < probability else 0

    department = DEPARTMENTS[index % len(DEPARTMENTS)]
    batch = rng.choice(BATCHES)
    seq = index + 1
    register_number = f"{batch[2:]}{department}{seq:04d}"
    name = f"{rng.choice(_FIRST_NAMES)} {rng.choice(_LAST_NAMES)}"

    record: dict[str, object] = {
        "register_number": register_number,
        "name": name,
        "department": department,
        "batch": batch,
        **features,
        TARGET_COLUMN: placed,
    }
    return record


def generate(rows: int, out_path: str, seed: int = 42) -> int:
    """Generate ``rows`` synthetic students and write them to ``out_path``.

    Returns the number of data rows written (excluding the header). The output
    directory is created if it does not already exist.
    """
    if rows <= 0:
        raise ValueError("rows must be a positive integer")

    rng = random.Random(seed)

    import os

    out_dir = os.path.dirname(os.path.abspath(out_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    written = 0
    with open(out_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADER)
        writer.writeheader()
        for index in range(rows):
            writer.writerow(_make_student(rng, index))
            written += 1
    return written


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m ml.data.generate_dataset",
        description="Generate a correlated synthetic placement dataset (stdlib only).",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=2000,
        help="Number of student rows to generate (default: 2000).",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="../data/sample_students.csv",
        help="Output CSV path (default: ../data/sample_students.csv).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns a process exit code."""
    args = _build_arg_parser().parse_args(argv)
    count = generate(rows=args.rows, out_path=args.out, seed=args.seed)
    print(f"Wrote {count} rows to {args.out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
