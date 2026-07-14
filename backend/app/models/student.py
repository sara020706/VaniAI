"""Student profile and record models: academics, skills, experience, resume, interviews."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.common import TimestampMixin, utcnow

if TYPE_CHECKING:
    from app.models.prediction import Prediction, Recommendation
    from app.models.user import User


class Student(Base, TimestampMixin):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    register_number: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    department: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    batch: Mapped[str] = mapped_column(String(8), index=True, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped[User] = relationship("User", back_populates="student")
    academic_records: Mapped[list[AcademicRecord]] = relationship(
        "AcademicRecord", back_populates="student", cascade="all, delete-orphan"
    )
    skill_records: Mapped[list[SkillRecord]] = relationship(
        "SkillRecord", back_populates="student", cascade="all, delete-orphan"
    )
    projects: Mapped[list[Project]] = relationship(
        "Project", back_populates="student", cascade="all, delete-orphan"
    )
    internships: Mapped[list[Internship]] = relationship(
        "Internship", back_populates="student", cascade="all, delete-orphan"
    )
    certifications: Mapped[list[Certification]] = relationship(
        "Certification", back_populates="student", cascade="all, delete-orphan"
    )
    hackathons: Mapped[list[Hackathon]] = relationship(
        "Hackathon", back_populates="student", cascade="all, delete-orphan"
    )
    resume_analyses: Mapped[list[ResumeAnalysis]] = relationship(
        "ResumeAnalysis", back_populates="student", cascade="all, delete-orphan"
    )
    interview_scores: Mapped[list[InterviewScore]] = relationship(
        "InterviewScore", back_populates="student", cascade="all, delete-orphan"
    )
    predictions: Mapped[list[Prediction]] = relationship(
        "Prediction", back_populates="student", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list[Recommendation]] = relationship(
        "Recommendation", back_populates="student", cascade="all, delete-orphan"
    )


class AcademicRecord(Base):
    __tablename__ = "academic_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cgpa: Mapped[float] = mapped_column(Float, nullable=False)
    tenth_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    twelfth_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    attendance_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    student: Mapped[Student] = relationship("Student", back_populates="academic_records")


class SkillRecord(Base):
    __tablename__ = "skill_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    coding_score: Mapped[float] = mapped_column(Float, nullable=False)
    aptitude_score: Mapped[float] = mapped_column(Float, nullable=False)
    communication_score: Mapped[float] = mapped_column(Float, nullable=False)
    technical_skill_score: Mapped[float] = mapped_column(Float, nullable=False)
    leadership_score: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    student: Mapped[Student] = relationship("Student", back_populates="skill_records")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tech_stack: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    student: Mapped[Student] = relationship("Student", back_populates="projects")


class Internship(Base):
    __tablename__ = "internships"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_months: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    student: Mapped[Student] = relationship("Student", back_populates="internships")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    issuer: Mapped[str] = mapped_column(String(255), nullable=False)
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    credential_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    student: Mapped[Student] = relationship("Student", back_populates="certifications")


class Hackathon(Base):
    __tablename__ = "hackathons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    student: Mapped[Student] = relationship("Student", back_populates="hackathons")


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    resume_score: Mapped[float] = mapped_column(Float, nullable=False)
    ats_score: Mapped[float] = mapped_column(Float, nullable=False)
    extracted: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    missing_sections: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    suggestions: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    student: Mapped[Student] = relationship("Student", back_populates="resume_analyses")


class InterviewScore(Base):
    __tablename__ = "interview_scores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mock_interview_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_level: Mapped[str] = mapped_column(String(16), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    entered_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    student: Mapped[Student] = relationship("Student", back_populates="interview_scores")
