"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.core.database import Base
from app.models.ml import Dataset, Experiment, ModelVersion, MonitoringLog
from app.models.prediction import Prediction, Recommendation
from app.models.report import Report
from app.models.student import (
    AcademicRecord,
    Certification,
    Hackathon,
    Internship,
    InterviewScore,
    Project,
    ResumeAnalysis,
    SkillRecord,
    Student,
)
from app.models.user import RefreshToken, User

__all__ = [
    "AcademicRecord",
    "Base",
    "Certification",
    "Dataset",
    "Experiment",
    "Hackathon",
    "Internship",
    "InterviewScore",
    "ModelVersion",
    "MonitoringLog",
    "Prediction",
    "Project",
    "Recommendation",
    "RefreshToken",
    "Report",
    "ResumeAnalysis",
    "SkillRecord",
    "Student",
    "User",
]
