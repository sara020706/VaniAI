"""Cohort analytics + placement dashboard aggregation.

All aggregates are computed from a single "student snapshot" query that joins each
student to their latest academic record, latest skill record, and latest
prediction using grouped-max subqueries (no N+1). The resulting rows are then
folded into the various dashboard/analytics shapes in Python, which keeps the
bucketing logic in one place and works identically on PostgreSQL and SQLite.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.models.prediction import Prediction
from app.models.student import AcademicRecord, ResumeAnalysis, SkillRecord, Student
from app.schemas.common import DEPARTMENTS

READY_PROBABILITY_THRESHOLD = 0.70
# 10-wide buckets spanning 0-100 (probability rescaled to percent for bucketing).
_BUCKET_EDGES: tuple[tuple[int, int], ...] = (
    (0, 10),
    (10, 20),
    (20, 30),
    (30, 40),
    (40, 50),
    (50, 60),
    (60, 70),
    (70, 80),
    (80, 90),
    (90, 100),
)
_BUCKET_LABELS: tuple[str, ...] = tuple(f"{lo}-{hi}" for lo, hi in _BUCKET_EDGES)

# Weak-skill / skill-gap target thresholds (mirrors ml.recommendation.career targets).
_SKILL_TARGETS: dict[str, float] = {
    "coding": 70.0,
    "aptitude": 70.0,
    "communication": 70.0,
    "technical": 70.0,
    "leadership": 70.0,
}


@dataclass
class StudentSnapshot:
    """A single student's latest-known values across all record types."""

    student_id: int
    full_name: str
    register_number: str
    department: str
    batch: str
    semester: int
    cgpa: float | None
    tenth_percentage: float | None
    twelfth_percentage: float | None
    attendance_percentage: float | None
    coding_score: float | None
    aptitude_score: float | None
    communication_score: float | None
    technical_skill_score: float | None
    leadership_score: float | None
    resume_score: float | None
    placement_probability: float | None
    readiness_overall: float | None
    risk_level: str | None
    risk_reasons: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------------------
# Latest-record subqueries
# --------------------------------------------------------------------------------------


def _latest_academic_ids() -> Select[tuple[int]]:
    return select(func.max(AcademicRecord.id)).group_by(AcademicRecord.student_id)


def _latest_skill_ids() -> Select[tuple[int]]:
    return select(func.max(SkillRecord.id)).group_by(SkillRecord.student_id)


def _latest_prediction_ids() -> Select[tuple[int]]:
    return select(func.max(Prediction.id)).group_by(Prediction.student_id)


def _latest_resume_ids() -> Select[tuple[int]]:
    return select(func.max(ResumeAnalysis.id)).group_by(ResumeAnalysis.student_id)


def _snapshot_query(
    *,
    department: str | None = None,
    batch: str | None = None,
) -> Select[Any]:
    """Build the joined latest-values query, optionally filtered by dept/batch."""
    acad = AcademicRecord.__table__.alias("acad")
    skill = SkillRecord.__table__.alias("skill")
    pred = Prediction.__table__.alias("pred")
    resume = ResumeAnalysis.__table__.alias("resume")

    stmt = (
        select(
            Student.id.label("student_id"),
            Student.register_number,
            Student.department,
            Student.batch,
            Student.semester,
            acad.c.cgpa,
            acad.c.tenth_percentage,
            acad.c.twelfth_percentage,
            acad.c.attendance_percentage,
            skill.c.coding_score,
            skill.c.aptitude_score,
            skill.c.communication_score,
            skill.c.technical_skill_score,
            skill.c.leadership_score,
            resume.c.resume_score,
            pred.c.placement_probability,
            pred.c.risk_level,
            pred.c.risk_reasons,
            pred.c.readiness,
        )
        .select_from(Student)
        .join(acad, and_(acad.c.student_id == Student.id, acad.c.id.in_(_latest_academic_ids())), isouter=True)
        .join(skill, and_(skill.c.student_id == Student.id, skill.c.id.in_(_latest_skill_ids())), isouter=True)
        .join(pred, and_(pred.c.student_id == Student.id, pred.c.id.in_(_latest_prediction_ids())), isouter=True)
        .join(resume, and_(resume.c.student_id == Student.id, resume.c.id.in_(_latest_resume_ids())), isouter=True)
    )
    if department is not None:
        stmt = stmt.where(Student.department == department)
    if batch is not None:
        stmt = stmt.where(Student.batch == batch)
    return stmt


def load_snapshots(
    db: Session,
    *,
    department: str | None = None,
    batch: str | None = None,
) -> list[StudentSnapshot]:
    """Fetch one snapshot row per student (optionally filtered), plus full_name.

    ``full_name`` lives on ``users`` and is resolved via the student->user
    relationship in a second batched query keyed by student id.
    """
    rows = db.execute(_snapshot_query(department=department, batch=batch)).all()
    if not rows:
        return []

    # Batch-load full names (they live on the users table) in a single query keyed
    # by student id, avoiding a per-student lookup.
    name_map: dict[int, str] = {}
    students = (
        db.execute(select(Student).where(Student.id.in_([row.student_id for row in rows])))
        .scalars()
        .all()
    )
    for student in students:
        name_map[student.id] = student.user.full_name if student.user is not None else ""

    snapshots: list[StudentSnapshot] = []
    for row in rows:
        readiness = row.readiness or {}
        readiness_overall = (
            float(readiness.get("overall")) if readiness.get("overall") is not None else None
        )
        reasons = row.risk_reasons if isinstance(row.risk_reasons, list) else []
        snapshots.append(
            StudentSnapshot(
                student_id=row.student_id,
                full_name=name_map.get(row.student_id, ""),
                register_number=row.register_number,
                department=row.department,
                batch=row.batch,
                semester=row.semester,
                cgpa=row.cgpa,
                tenth_percentage=row.tenth_percentage,
                twelfth_percentage=row.twelfth_percentage,
                attendance_percentage=row.attendance_percentage,
                coding_score=row.coding_score,
                aptitude_score=row.aptitude_score,
                communication_score=row.communication_score,
                technical_skill_score=row.technical_skill_score,
                leadership_score=row.leadership_score,
                resume_score=row.resume_score,
                placement_probability=row.placement_probability,
                readiness_overall=readiness_overall,
                risk_level=row.risk_level,
                risk_reasons=[str(reason) for reason in reasons],
            )
        )
    return snapshots


# --------------------------------------------------------------------------------------
# Small numeric helpers
# --------------------------------------------------------------------------------------


def _avg(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return round(sum(clean) / len(clean), 2)


def _bucket_index(value: float) -> int:
    """Map a 0-100 value to a bucket index (100 falls in the top bucket)."""
    if value >= 100:
        return len(_BUCKET_EDGES) - 1
    if value < 0:
        return 0
    return min(int(value // 10), len(_BUCKET_EDGES) - 1)


def _bucketize(values: list[float]) -> list[dict[str, Any]]:
    counts = [0] * len(_BUCKET_EDGES)
    for value in values:
        if value is None:
            continue
        counts[_bucket_index(value)] += 1
    return [{"bucket": label, "count": count} for label, count in zip(_BUCKET_LABELS, counts)]


def _risk_distribution(snapshots: list[StudentSnapshot]) -> dict[str, int]:
    dist = {"low": 0, "medium": 0, "high": 0}
    for snap in snapshots:
        if snap.risk_level in dist:
            dist[snap.risk_level] += 1
    return dist


def _skill_averages(snapshots: list[StudentSnapshot]) -> dict[str, float]:
    return {
        "coding": _avg([s.coding_score for s in snapshots]) or 0.0,
        "aptitude": _avg([s.aptitude_score for s in snapshots]) or 0.0,
        "communication": _avg([s.communication_score for s in snapshots]) or 0.0,
        "technical": _avg([s.technical_skill_score for s in snapshots]) or 0.0,
        "leadership": _avg([s.leadership_score for s in snapshots]) or 0.0,
    }


def snapshot_to_list_item(snap: StudentSnapshot) -> dict[str, Any]:
    """Serialize a snapshot into a ``StudentListItem`` dict."""
    return {
        "id": snap.student_id,
        "full_name": snap.full_name,
        "register_number": snap.register_number,
        "department": snap.department,
        "batch": snap.batch,
        "semester": snap.semester,
        "cgpa": snap.cgpa,
        "placement_probability": snap.placement_probability,
        "readiness_overall": snap.readiness_overall,
        "risk_level": snap.risk_level,
    }


# --------------------------------------------------------------------------------------
# Placement dashboard
# --------------------------------------------------------------------------------------


def placement_dashboard(db: Session) -> dict[str, Any]:
    """Aggregate the full placement-officer dashboard payload (contracts 7)."""
    snapshots = load_snapshots(db)
    total_students = len(snapshots)

    probabilities = [s.placement_probability for s in snapshots if s.placement_probability is not None]
    ready_count = sum(
        1 for p in probabilities if p >= READY_PROBABILITY_THRESHOLD
    )
    average_probability = _avg(probabilities)

    # Probability distribution (probability 0-1 rescaled to 0-100 for buckets).
    probability_distribution = _bucketize([p * 100 for p in probabilities])

    # Department comparison.
    by_dept: dict[str, list[StudentSnapshot]] = defaultdict(list)
    for snap in snapshots:
        by_dept[snap.department].append(snap)

    department_comparison: list[dict[str, Any]] = []
    for dept in DEPARTMENTS:
        members = by_dept.get(dept, [])
        dept_probs = [m.placement_probability for m in members if m.placement_probability is not None]
        dept_ready = sum(1 for p in dept_probs if p >= READY_PROBABILITY_THRESHOLD)
        department_comparison.append(
            {
                "department": dept,
                "average_probability": _avg(dept_probs),
                "average_readiness": _avg(
                    [m.readiness_overall for m in members if m.readiness_overall is not None]
                ),
                "student_count": len(members),
                "ready_count": dept_ready,
            }
        )

    # Top skills (cohort averages, sorted desc).
    skill_avgs = _skill_averages(snapshots)
    top_skills = sorted(
        ({"skill": name, "average": value} for name, value in skill_avgs.items()),
        key=lambda item: item["average"],
        reverse=True,
    )

    # Common weak skills: students below target for each skill.
    common_weak_skills = _common_weak_skills(snapshots)

    # Risk heatmap: department x batch grid.
    heatmap: dict[tuple[str, str], dict[str, int]] = {}
    for snap in snapshots:
        key = (snap.department, snap.batch)
        cell = heatmap.setdefault(key, {"high_risk_count": 0, "student_count": 0})
        cell["student_count"] += 1
        if snap.risk_level == "high":
            cell["high_risk_count"] += 1
    risk_heatmap = [
        {
            "department": dept,
            "batch": batch,
            "high_risk_count": cell["high_risk_count"],
            "student_count": cell["student_count"],
        }
        for (dept, batch), cell in sorted(heatmap.items())
    ]

    return {
        "total_students": total_students,
        "placement_ready_count": ready_count,
        "average_probability": average_probability,
        "probability_distribution": probability_distribution,
        "department_comparison": department_comparison,
        "risk_distribution": _risk_distribution(snapshots),
        "top_skills": top_skills,
        "common_weak_skills": common_weak_skills,
        "risk_heatmap": risk_heatmap,
    }


def _common_weak_skills(snapshots: list[StudentSnapshot]) -> list[dict[str, Any]]:
    """Count students scoring below target for each skill, sorted worst-first."""
    accessors = {
        "coding": lambda s: s.coding_score,
        "aptitude": lambda s: s.aptitude_score,
        "communication": lambda s: s.communication_score,
        "technical": lambda s: s.technical_skill_score,
        "leadership": lambda s: s.leadership_score,
    }
    weak: list[dict[str, Any]] = []
    for skill, accessor in accessors.items():
        target = _SKILL_TARGETS[skill]
        below = sum(
            1
            for snap in snapshots
            if accessor(snap) is not None and accessor(snap) < target
        )
        weak.append({"skill": skill, "students_below_target": below})
    weak.sort(key=lambda item: item["students_below_target"], reverse=True)
    return weak


def at_risk_students(
    db: Session, *, page: int, page_size: int
) -> dict[str, Any]:
    """Return a paginated page of at-risk (high/medium risk) students.

    Ordered by ascending placement probability (most at-risk first), with the
    latest prediction's risk reasons attached. Students without a prediction are
    excluded (no risk information to report).
    """
    snapshots = [
        snap
        for snap in load_snapshots(db)
        if snap.risk_level in ("high", "medium")
    ]

    def sort_key(snap: StudentSnapshot) -> tuple[int, float]:
        risk_rank = 0 if snap.risk_level == "high" else 1
        prob = snap.placement_probability if snap.placement_probability is not None else 1.0
        return (risk_rank, prob)

    snapshots.sort(key=sort_key)

    total = len(snapshots)
    start = (page - 1) * page_size
    window = snapshots[start : start + page_size]
    items = [
        {**snapshot_to_list_item(snap), "risk_reasons": snap.risk_reasons}
        for snap in window
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def export_rows(db: Session) -> list[dict[str, Any]]:
    """Return all students as StudentListItem-shaped dicts for CSV export."""
    snapshots = load_snapshots(db)
    snapshots.sort(key=lambda s: (s.department, s.register_number))
    return [snapshot_to_list_item(snap) for snap in snapshots]


# --------------------------------------------------------------------------------------
# Analytics endpoints
# --------------------------------------------------------------------------------------


def distributions(db: Session) -> dict[str, Any]:
    """Probability / readiness / resume-score histograms + risk distribution."""
    snapshots = load_snapshots(db)
    probabilities = [
        s.placement_probability * 100
        for s in snapshots
        if s.placement_probability is not None
    ]
    readiness = [s.readiness_overall for s in snapshots if s.readiness_overall is not None]
    resume = [s.resume_score for s in snapshots if s.resume_score is not None]
    return {
        "probability": _bucketize(probabilities),
        "readiness": _bucketize(readiness),
        "resume_score": _bucketize(resume),
        "risk": _risk_distribution(snapshots),
    }


def department_analytics(db: Session) -> list[dict[str, Any]]:
    """Per-department analytics rows for every department (contracts 7)."""
    snapshots = load_snapshots(db)
    by_dept: dict[str, list[StudentSnapshot]] = defaultdict(list)
    for snap in snapshots:
        by_dept[snap.department].append(snap)

    result: list[dict[str, Any]] = []
    for dept in DEPARTMENTS:
        members = by_dept.get(dept, [])
        probs = [m.placement_probability for m in members if m.placement_probability is not None]
        ready_count = sum(1 for p in probs if p >= READY_PROBABILITY_THRESHOLD)
        at_risk_count = sum(1 for m in members if m.risk_level == "high")
        result.append(
            {
                "department": dept,
                "student_count": len(members),
                "average_cgpa": _avg([m.cgpa for m in members if m.cgpa is not None]),
                "average_probability": _avg(probs),
                "average_readiness": _avg(
                    [m.readiness_overall for m in members if m.readiness_overall is not None]
                ),
                "ready_count": ready_count,
                "at_risk_count": at_risk_count,
            }
        )
    return result


def skill_analytics(db: Session, *, department: str | None = None) -> dict[str, Any]:
    """Skill averages + per-skill distribution, optionally scoped to a department."""
    snapshots = load_snapshots(db, department=department)
    skill_avgs = _skill_averages(snapshots)

    accessors = {
        "coding": lambda s: s.coding_score,
        "aptitude": lambda s: s.aptitude_score,
        "communication": lambda s: s.communication_score,
        "technical": lambda s: s.technical_skill_score,
        "leadership": lambda s: s.leadership_score,
    }
    skill_distribution = [
        {
            "skill": skill,
            "buckets": _bucketize(
                [accessor(snap) for snap in snapshots if accessor(snap) is not None]
            ),
        }
        for skill, accessor in accessors.items()
    ]
    return {"skill_averages": skill_avgs, "skill_distribution": skill_distribution}
