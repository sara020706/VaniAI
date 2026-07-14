"""Initial schema: all VaniAI tables (contracts section 5).

Revision ID: 0001
Revises:
Create Date: 2026-07-14 00:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- users -------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # --- refresh_tokens ----------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_refresh_tokens_token_hash"), "refresh_tokens", ["token_hash"], unique=False
    )

    # --- students ----------------------------------------------------------------
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("register_number", sa.String(length=32), nullable=False),
        sa.Column("department", sa.String(length=16), nullable=False),
        sa.Column("batch", sa.String(length=8), nullable=False),
        sa.Column("semester", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_students_user_id"), "students", ["user_id"], unique=True)
    op.create_index(
        op.f("ix_students_register_number"), "students", ["register_number"], unique=True
    )
    op.create_index(op.f("ix_students_department"), "students", ["department"], unique=False)
    op.create_index(op.f("ix_students_batch"), "students", ["batch"], unique=False)

    # --- academic_records --------------------------------------------------------
    op.create_table(
        "academic_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("cgpa", sa.Float(), nullable=False),
        sa.Column("tenth_percentage", sa.Float(), nullable=False),
        sa.Column("twelfth_percentage", sa.Float(), nullable=False),
        sa.Column("attendance_percentage", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_academic_records_student_id"), "academic_records", ["student_id"], unique=False
    )

    # --- skill_records -----------------------------------------------------------
    op.create_table(
        "skill_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("coding_score", sa.Float(), nullable=False),
        sa.Column("aptitude_score", sa.Float(), nullable=False),
        sa.Column("communication_score", sa.Float(), nullable=False),
        sa.Column("technical_skill_score", sa.Float(), nullable=False),
        sa.Column("leadership_score", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_skill_records_student_id"), "skill_records", ["student_id"], unique=False
    )

    # --- projects ----------------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tech_stack", sa.String(length=512), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_student_id"), "projects", ["student_id"], unique=False)

    # --- internships -------------------------------------------------------------
    op.create_table(
        "internships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=255), nullable=False),
        sa.Column("duration_months", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_internships_student_id"), "internships", ["student_id"], unique=False)

    # --- certifications ----------------------------------------------------------
    op.create_table(
        "certifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("issuer", sa.String(length=255), nullable=False),
        sa.Column("issued_date", sa.Date(), nullable=True),
        sa.Column("credential_url", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_certifications_student_id"), "certifications", ["student_id"], unique=False
    )

    # --- hackathons --------------------------------------------------------------
    op.create_table(
        "hackathons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=128), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hackathons_student_id"), "hackathons", ["student_id"], unique=False)

    # --- resume_analyses ---------------------------------------------------------
    op.create_table(
        "resume_analyses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("resume_score", sa.Float(), nullable=False),
        sa.Column("ats_score", sa.Float(), nullable=False),
        sa.Column("extracted", sa.JSON(), nullable=False),
        sa.Column("missing_sections", sa.JSON(), nullable=False),
        sa.Column("suggestions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_resume_analyses_student_id"), "resume_analyses", ["student_id"], unique=False
    )

    # --- interview_scores --------------------------------------------------------
    op.create_table(
        "interview_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("mock_interview_score", sa.Float(), nullable=False),
        sa.Column("confidence_level", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("entered_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entered_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_interview_scores_student_id"), "interview_scores", ["student_id"], unique=False
    )
    op.create_index(
        op.f("ix_interview_scores_entered_by"), "interview_scores", ["entered_by"], unique=False
    )

    # --- predictions -------------------------------------------------------------
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("placement_probability", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=16), nullable=False),
        sa.Column("risk_reasons", sa.JSON(), nullable=False),
        sa.Column("readiness", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_predictions_student_id"), "predictions", ["student_id"], unique=False)

    # --- recommendations ---------------------------------------------------------
    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("prediction_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["prediction_id"], ["predictions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recommendations_prediction_id"), "recommendations", ["prediction_id"], unique=False
    )
    op.create_index(
        op.f("ix_recommendations_student_id"), "recommendations", ["student_id"], unique=False
    )

    # --- reports -----------------------------------------------------------------
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("report_type", sa.String(length=32), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("generated_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["generated_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reports_student_id"), "reports", ["student_id"], unique=False)
    op.create_index(op.f("ix_reports_generated_by"), "reports", ["generated_by"], unique=False)

    # --- datasets ----------------------------------------------------------------
    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("validation_errors", sa.JSON(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_datasets_uploaded_by"), "datasets", ["uploaded_by"], unique=False)

    # --- experiments -------------------------------------------------------------
    op.create_table(
        "experiments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("mlflow_run_id", sa.String(length=64), nullable=True),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("model_type", sa.String(length=64), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_experiments_dataset_id"), "experiments", ["dataset_id"], unique=False)

    # --- model_versions ----------------------------------------------------------
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("model_type", sa.String(length=64), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("mlflow_run_id", sa.String(length=64), nullable=True),
        sa.Column("artifact_path", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_model_versions_version"), "model_versions", ["version"], unique=True)

    # --- monitoring_logs ---------------------------------------------------------
    op.create_table(
        "monitoring_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("metric_type", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("drift_detected", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("monitoring_logs")
    op.drop_index(op.f("ix_model_versions_version"), table_name="model_versions")
    op.drop_table("model_versions")
    op.drop_index(op.f("ix_experiments_dataset_id"), table_name="experiments")
    op.drop_table("experiments")
    op.drop_index(op.f("ix_datasets_uploaded_by"), table_name="datasets")
    op.drop_table("datasets")
    op.drop_index(op.f("ix_reports_generated_by"), table_name="reports")
    op.drop_index(op.f("ix_reports_student_id"), table_name="reports")
    op.drop_table("reports")
    op.drop_index(op.f("ix_recommendations_student_id"), table_name="recommendations")
    op.drop_index(op.f("ix_recommendations_prediction_id"), table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_index(op.f("ix_predictions_student_id"), table_name="predictions")
    op.drop_table("predictions")
    op.drop_index(op.f("ix_interview_scores_entered_by"), table_name="interview_scores")
    op.drop_index(op.f("ix_interview_scores_student_id"), table_name="interview_scores")
    op.drop_table("interview_scores")
    op.drop_index(op.f("ix_resume_analyses_student_id"), table_name="resume_analyses")
    op.drop_table("resume_analyses")
    op.drop_index(op.f("ix_hackathons_student_id"), table_name="hackathons")
    op.drop_table("hackathons")
    op.drop_index(op.f("ix_certifications_student_id"), table_name="certifications")
    op.drop_table("certifications")
    op.drop_index(op.f("ix_internships_student_id"), table_name="internships")
    op.drop_table("internships")
    op.drop_index(op.f("ix_projects_student_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_skill_records_student_id"), table_name="skill_records")
    op.drop_table("skill_records")
    op.drop_index(op.f("ix_academic_records_student_id"), table_name="academic_records")
    op.drop_table("academic_records")
    op.drop_index(op.f("ix_students_batch"), table_name="students")
    op.drop_index(op.f("ix_students_department"), table_name="students")
    op.drop_index(op.f("ix_students_register_number"), table_name="students")
    op.drop_index(op.f("ix_students_user_id"), table_name="students")
    op.drop_table("students")
    op.drop_index(op.f("ix_refresh_tokens_token_hash"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
