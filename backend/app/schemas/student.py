"""Student profile, sub-resource, progress, and resume-analysis schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import Department, RiskLevel
from app.schemas.prediction import PredictionOut

# --- Sub-resources -------------------------------------------------------------------


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    tech_stack: str = Field(min_length=1, max_length=512)
    url: str | None = Field(default=None, max_length=512)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    tech_stack: str
    url: str | None


class InternshipCreate(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    duration_months: int = Field(ge=1, le=60)
    description: str | None = None


class InternshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    role: str
    duration_months: int
    description: str | None


class CertificationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    issuer: str = Field(min_length=1, max_length=255)
    issued_date: date | None = None
    credential_url: str | None = Field(default=None, max_length=512)


class CertificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    issuer: str
    issued_date: date | None
    credential_url: str | None


class HackathonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    position: str | None = Field(default=None, max_length=128)
    event_date: date | None = None


class HackathonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    position: str | None
    event_date: date | None


# --- Profile sections ----------------------------------------------------------------


class AcademicInfo(BaseModel):
    """Latest academic snapshot; null until the student records values."""

    cgpa: float | None = Field(default=None, ge=0, le=10)
    tenth_percentage: float | None = Field(default=None, ge=0, le=100)
    twelfth_percentage: float | None = Field(default=None, ge=0, le=100)
    attendance_percentage: float | None = Field(default=None, ge=0, le=100)


class SkillsInfo(BaseModel):
    """Latest skill snapshot; null until the student records values."""

    coding_score: float | None = Field(default=None, ge=0, le=100)
    aptitude_score: float | None = Field(default=None, ge=0, le=100)
    communication_score: float | None = Field(default=None, ge=0, le=100)
    technical_skill_score: float | None = Field(default=None, ge=0, le=100)
    leadership_score: float | None = Field(default=None, ge=0, le=100)


class ExperienceInfo(BaseModel):
    internship_count: int = 0
    project_count: int = 0
    certification_count: int = 0
    hackathon_count: int = 0
    projects: list[ProjectOut] = Field(default_factory=list)
    internships: list[InternshipOut] = Field(default_factory=list)
    certifications: list[CertificationOut] = Field(default_factory=list)
    hackathons: list[HackathonOut] = Field(default_factory=list)


class ProfessionalInfo(BaseModel):
    resume_score: float | None = Field(default=None, ge=0, le=100)
    mock_interview_score: float | None = Field(default=None, ge=0, le=100)


# --- Main student shapes -------------------------------------------------------------


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    full_name: str
    email: EmailStr
    register_number: str
    department: Department
    batch: str
    semester: int
    academic: AcademicInfo
    skills: SkillsInfo
    experience: ExperienceInfo
    professional: ProfessionalInfo
    latest_prediction: PredictionOut | None = None


class StudentUpdate(BaseModel):
    """PUT /students/me body — every field optional; academic/skill changes create
    a new academic_records / skill_records snapshot."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    department: Department | None = None
    batch: str | None = Field(default=None, min_length=4, max_length=8)
    semester: int | None = Field(default=None, ge=1, le=8)
    cgpa: float | None = Field(default=None, ge=0, le=10)
    tenth_percentage: float | None = Field(default=None, ge=0, le=100)
    twelfth_percentage: float | None = Field(default=None, ge=0, le=100)
    attendance_percentage: float | None = Field(default=None, ge=0, le=100)
    coding_score: float | None = Field(default=None, ge=0, le=100)
    aptitude_score: float | None = Field(default=None, ge=0, le=100)
    communication_score: float | None = Field(default=None, ge=0, le=100)
    technical_skill_score: float | None = Field(default=None, ge=0, le=100)
    leadership_score: float | None = Field(default=None, ge=0, le=100)


class StudentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    register_number: str
    department: Department
    batch: str
    semester: int
    cgpa: float | None = None
    placement_probability: float | None = None
    readiness_overall: float | None = None
    risk_level: RiskLevel | None = None


# --- Progress ------------------------------------------------------------------------


class AcademicHistoryPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recorded_at: datetime
    cgpa: float
    attendance_percentage: float


class SkillHistoryPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recorded_at: datetime
    coding_score: float
    aptitude_score: float
    communication_score: float
    technical_skill_score: float
    leadership_score: float


class PredictionHistoryPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    placement_probability: float
    readiness_overall: float


class StudentProgress(BaseModel):
    academic_history: list[AcademicHistoryPoint]
    skill_history: list[SkillHistoryPoint]
    prediction_history: list[PredictionHistoryPoint]


# --- Resume analysis -----------------------------------------------------------------


class ResumeAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    resume_score: float = Field(ge=0, le=100)
    ats_score: float = Field(ge=0, le=100)
    extracted: dict[str, Any]
    missing_sections: list[str]
    suggestions: list[str]
    created_at: datetime
