"""Idempotent demo-data seed (CONTRACTS.md section 10).

Run from the ``backend/`` directory::

    python -m scripts.seed

Creates the four demo accounts, 150 synthetic students (each with 2-4 historical
academic/skill snapshots plus projects/internships/certifications/hackathons),
generates a 2000-row training CSV via ``ml.data.generate_dataset``, registers it
as a dataset row, trains and registers a model via ``ml.training.train``, and
runs a prediction for every student. Skips creation when demo users already
exist, so re-running is safe.
"""

from __future__ import annotations

import logging
import random
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from faker import Faker
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.ml import Dataset, ModelVersion
from app.models.student import (
    AcademicRecord,
    Certification,
    Hackathon,
    Internship,
    Project,
    SkillRecord,
    Student,
)
from app.models.user import User

logger = logging.getLogger("vaniai.seed")

DEPARTMENTS: tuple[str, ...] = ("CSE", "IT", "ECE", "EEE", "MECH", "CIVIL")
BATCHES: tuple[str, ...] = ("2024", "2025", "2026", "2027")
NUM_STUDENTS = 150
DATASET_ROWS = 2000
RANDOM_SEED = 42


@dataclass(frozen=True)
class DemoAccount:
    """A named demo login shown in the credentials table."""

    email: str
    password: str
    role: str
    full_name: str


DEMO_ACCOUNTS: tuple[DemoAccount, ...] = (
    DemoAccount("admin@vaniai.io", "Admin@123", "admin", "Vani Admin"),
    DemoAccount("faculty@vaniai.io", "Faculty@123", "faculty", "Dr. Faculty Mentor"),
    DemoAccount("placement@vaniai.io", "Placement@123", "placement_officer", "Placement Officer"),
    DemoAccount("student@vaniai.io", "Student@123", "student", "Demo Student"),
)


# --- Random profile helpers ---------------------------------------------------------


def _score(rng: random.Random, low: float, high: float) -> float:
    """Uniform score in ``[low, high]`` rounded to 1 decimal, clamped to 0-100."""
    return round(min(100.0, max(0.0, rng.uniform(low, high))), 1)


def _cgpa(rng: random.Random) -> float:
    """Plausible CGPA in the 5.0-9.8 range (rounded 2dp)."""
    return round(min(10.0, max(0.0, rng.uniform(5.0, 9.8))), 2)


def _register_number(rng: random.Random, department: str, seq: int) -> str:
    """Build a register number like ``21CSE001`` from batch year + dept + counter."""
    year_suffix = rng.choice(["21", "22", "23", "24"])
    return f"{year_suffix}{department}{seq:03d}"


def _make_academic_snapshot(
    rng: random.Random, student_id: int, recorded_at: datetime, level: float
) -> AcademicRecord:
    """One academic record; ``level`` (0-1) nudges overall strength / progression."""
    return AcademicRecord(
        student_id=student_id,
        cgpa=round(min(10.0, 5.0 + level * 4.5 + rng.uniform(-0.3, 0.3)), 2),
        tenth_percentage=_score(rng, 60 + level * 30, 75 + level * 24),
        twelfth_percentage=_score(rng, 60 + level * 30, 75 + level * 24),
        attendance_percentage=_score(rng, 65 + level * 25, 80 + level * 19),
        recorded_at=recorded_at,
    )


def _make_skill_snapshot(
    rng: random.Random, student_id: int, recorded_at: datetime, level: float
) -> SkillRecord:
    """One skill record; ``level`` (0-1) sets the general skill band."""
    base = 40 + level * 45
    return SkillRecord(
        student_id=student_id,
        coding_score=_score(rng, base - 10, base + 15),
        aptitude_score=_score(rng, base - 8, base + 12),
        communication_score=_score(rng, base - 12, base + 10),
        technical_skill_score=_score(rng, base - 8, base + 15),
        leadership_score=_score(rng, base - 15, base + 8),
        recorded_at=recorded_at,
    )


# --- Seed steps ---------------------------------------------------------------------


def _already_seeded(session: Session) -> bool:
    """True when any demo account already exists (idempotency guard)."""
    emails = [account.email for account in DEMO_ACCOUNTS]
    existing = session.scalar(select(func.count()).select_from(User).where(User.email.in_(emails)))
    return bool(existing)


def _create_user(
    session: Session, *, email: str, password: str, full_name: str, role: str
) -> User:
    """Create and flush a single user."""
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=True,
    )
    session.add(user)
    session.flush()
    return user


def _seed_student_profile(
    session: Session,
    rng: random.Random,
    faker: Faker,
    *,
    student: Student,
    level: float,
) -> None:
    """Attach 2-4 historical snapshots and experience rows to a student."""
    snapshots = rng.randint(2, 4)
    now = datetime.now(UTC)
    for index in range(snapshots):
        # Oldest snapshot first; skill/academics improve slightly over time.
        months_ago = (snapshots - index) * 4
        recorded_at = now - timedelta(days=months_ago * 30)
        step_level = min(1.0, max(0.0, level - (snapshots - 1 - index) * 0.06))
        session.add(_make_academic_snapshot(rng, student.id, recorded_at, step_level))
        session.add(_make_skill_snapshot(rng, student.id, recorded_at, step_level))

    for _ in range(rng.randint(0, 3)):
        session.add(
            Project(
                student_id=student.id,
                title=faker.catch_phrase(),
                description=faker.paragraph(nb_sentences=3),
                tech_stack=", ".join(
                    rng.sample(
                        ["Python", "React", "FastAPI", "PostgreSQL", "Docker", "AWS", "TensorFlow"],
                        k=rng.randint(2, 4),
                    )
                ),
                url=faker.url() if rng.random() < 0.5 else None,
            )
        )

    for _ in range(rng.randint(0, 2)):
        session.add(
            Internship(
                student_id=student.id,
                company=faker.company(),
                role=rng.choice(
                    ["Software Intern", "Data Analyst Intern", "ML Intern", "QA Intern"]
                ),
                duration_months=rng.randint(1, 6),
                description=faker.sentence(nb_words=10),
            )
        )

    for _ in range(rng.randint(0, 3)):
        session.add(
            Certification(
                student_id=student.id,
                name=rng.choice(
                    [
                        "AWS Cloud Practitioner",
                        "Google Data Analytics",
                        "Oracle Java SE",
                        "Microsoft Azure Fundamentals",
                        "Coursera Machine Learning",
                    ]
                ),
                issuer=rng.choice(["AWS", "Google", "Oracle", "Microsoft", "Coursera"]),
                issued_date=date.today() - timedelta(days=rng.randint(30, 720)),
                credential_url=faker.url() if rng.random() < 0.6 else None,
            )
        )

    for _ in range(rng.randint(0, 2)):
        session.add(
            Hackathon(
                student_id=student.id,
                name=f"{faker.city()} Hackathon {rng.randint(2023, 2026)}",
                position=rng.choice(["Winner", "Runner-up", "Finalist", "Participant", None]),
                event_date=date.today() - timedelta(days=rng.randint(30, 720)),
            )
        )


def _seed_demo_and_students(session: Session, rng: random.Random, faker: Faker) -> list[int]:
    """Create demo accounts + 150 synthetic students; return all student ids."""
    student_ids: list[int] = []

    # Demo accounts (non-student roles have no student profile).
    demo_student_account: DemoAccount | None = None
    for account in DEMO_ACCOUNTS:
        user = _create_user(
            session,
            email=account.email,
            password=account.password,
            full_name=account.full_name,
            role=account.role,
        )
        if account.role == "student":
            demo_student_account = account
            student = Student(
                user_id=user.id,
                register_number="21CSE001",
                department="CSE",
                batch="2026",
                semester=6,
            )
            session.add(student)
            session.flush()
            _seed_student_profile(session, rng, faker, student=student, level=0.82)
            student_ids.append(student.id)

    if demo_student_account is None:  # defensive: the demo set always includes a student
        logger.warning("seed: no demo student account defined")

    # 150 synthetic students.
    per_department_counter: dict[str, int] = {dept: 1 for dept in DEPARTMENTS}
    for index in range(NUM_STUDENTS):
        department = DEPARTMENTS[index % len(DEPARTMENTS)]
        seq = per_department_counter[department]
        per_department_counter[department] += 1

        full_name = faker.name()
        email = f"student{index + 1:03d}@vaniai.io"
        user = _create_user(
            session,
            email=email,
            password="Student@123",
            full_name=full_name,
            role="student",
        )
        student = Student(
            user_id=user.id,
            register_number=_register_number(rng, department, seq),
            department=department,
            batch=rng.choice(BATCHES),
            semester=rng.randint(1, 8),
        )
        session.add(student)
        session.flush()
        level = rng.uniform(0.25, 0.98)
        _seed_student_profile(session, rng, faker, student=student, level=level)
        student_ids.append(student.id)

    session.commit()
    logger.info("seed: created %d students (incl. demo)", len(student_ids))
    return student_ids


def _generate_and_register_dataset(session: Session, uploaded_by: int) -> Dataset:
    """Generate a synthetic CSV via ``ml.data.generate_dataset`` and register it."""
    from ml.data.generate_dataset import generate  # lazy: heavy/ML-only import

    settings = get_settings()
    datasets_dir = Path(settings.upload_dir) / "datasets"
    datasets_dir.mkdir(parents=True, exist_ok=True)
    out_path = datasets_dir / "seed_dataset.csv"

    generate(rows=DATASET_ROWS, out=str(out_path))

    row_count = _count_csv_rows(out_path)
    dataset = Dataset(
        name="Seed Synthetic Dataset",
        filename=out_path.name,
        file_path=str(out_path),
        row_count=row_count,
        status="validated",
        validation_errors=None,
        uploaded_by=uploaded_by,
    )
    session.add(dataset)
    session.commit()
    session.refresh(dataset)
    logger.info("seed: registered dataset %s (%d rows)", dataset.id, row_count)
    return dataset


def _count_csv_rows(path: Path) -> int:
    """Count data rows in a CSV (excludes the header line)."""
    with path.open("r", encoding="utf-8", newline="") as handle:
        total = sum(1 for _ in handle)
    return max(0, total - 1)


def _train_model(session: Session, dataset: Dataset) -> None:
    """Train + register a model on the seed dataset and record the active version."""
    from ml.training.train import train_and_register  # lazy: heavy/ML-only import

    settings = get_settings()
    result = train_and_register(dataset_path=dataset.file_path, model_dir=settings.model_dir)

    version = str(result["version"])
    model_type = str(result["model_type"])
    metrics = dict(result.get("metrics") or {})
    mlflow_run_id = result.get("mlflow_run_id")
    artifact_path = f"{settings.model_dir}/versions/{version}/model.joblib"

    existing = session.scalars(
        select(ModelVersion).where(ModelVersion.version == version)
    ).first()
    if existing is None:
        session.add(
            ModelVersion(
                version=version,
                model_type=model_type,
                metrics=metrics,
                mlflow_run_id=str(mlflow_run_id) if mlflow_run_id is not None else None,
                artifact_path=artifact_path,
                is_active=True,
            )
        )
    else:
        existing.is_active = True
        existing.metrics = metrics
        existing.model_type = model_type
        existing.artifact_path = artifact_path

    # Mark the dataset as used and this version as the only active one.
    dataset.status = "used"
    for other in session.scalars(select(ModelVersion)).all():
        if other.version != version and other.is_active:
            other.is_active = False
    session.commit()
    logger.info("seed: trained model %s (%s)", version, model_type)


def _run_predictions(student_ids: list[int]) -> None:
    """Run the full prediction pipeline for every seeded student."""
    from app.services.prediction_service import run_prediction_for_student  # lazy import

    ok = 0
    for student_id in student_ids:
        session = SessionLocal()
        try:
            run_prediction_for_student(session, student_id)
            session.commit()
            ok += 1
        except Exception:  # noqa: BLE001 - one bad student must not abort the seed
            session.rollback()
            logger.exception("seed: prediction failed for student %s", student_id)
        finally:
            session.close()
    logger.info("seed: generated predictions for %d/%d students", ok, len(student_ids))


def _print_credentials() -> None:
    """Print the demo credentials table to stdout."""
    header = f"| {'Role':<18} | {'Email':<22} | {'Password':<14} |"
    divider = "|" + "-" * (len(header) - 2) + "|"
    print("\n" + "=" * len(header))
    print("  VaniAI demo accounts (password rules: >=8 chars)")
    print("=" * len(header))
    print(header)
    print(divider)
    for account in DEMO_ACCOUNTS:
        print(f"| {account.role:<18} | {account.email:<22} | {account.password:<14} |")
    print("=" * len(header) + "\n")


def seed() -> None:
    """Run the full idempotent seed."""
    settings = get_settings()
    Path(settings.model_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)

    rng = random.Random(RANDOM_SEED)
    faker = Faker()
    faker.seed_instance(RANDOM_SEED)

    session = SessionLocal()
    try:
        if _already_seeded(session):
            logger.info("seed: demo accounts already present - skipping data creation")
            print("Demo data already present; skipping seed.")
            _print_credentials()
            return

        student_ids = _seed_demo_and_students(session, rng, faker)

        admin = session.scalars(
            select(User).where(User.email == "admin@vaniai.io")
        ).first()
        if admin is None:  # defensive: the demo set always creates the admin account
            raise RuntimeError("seed: admin demo account was not created")
        uploaded_by = admin.id

        dataset = _generate_and_register_dataset(session, uploaded_by=uploaded_by)
        _train_model(session, dataset)
    finally:
        session.close()

    # Predictions use their own short-lived sessions per student.
    _run_predictions(student_ids)

    logger.info("seed: complete")
    _print_credentials()


def main() -> int:
    """Console entry point for ``python -m scripts.seed``."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        seed()
    except Exception:  # noqa: BLE001 - report a clean non-zero exit on failure
        logger.exception("seed: aborted with an error")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
