"""PDF report generation via reportlab (platypus).

Produces three report variants — student, department, placement — each rendered
with the VaniAI violet/blue brand header, profile/score tables, a readiness bar
chart (reportlab.graphics), a prediction summary, and a recommendations table
where applicable. Each generated file is saved under ``UPLOAD_DIR/reports/`` and a
``reports`` row is persisted. Services return the on-disk path + download filename;
the API layer wraps that in a ``FileResponse``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Flowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.student import Student
from app.models.user import User
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.report_repository import ReportRepository
from app.schemas.common import DEPARTMENTS
from app.services import analytics_service
from app.services.prediction_service import build_student_profile

# --- Brand palette (contracts 8.1: violet 262 83% 58% + blue) ------------------------
_VIOLET = colors.HexColor("#7c3aed")
_BLUE = colors.HexColor("#2563eb")
_INK = colors.HexColor("#1e293b")
_MUTED = colors.HexColor("#64748b")
_LIGHT_ROW = colors.HexColor("#f1f5f9")
_GOOD = colors.HexColor("#0ca30c")
_WARN = colors.HexColor("#fab219")
_CRIT = colors.HexColor("#d03b3b")


@dataclass
class GeneratedReport:
    """Result of a report generation: on-disk path + suggested download name."""

    file_path: str
    filename: str
    report_id: int


def _reports_dir() -> Path:
    settings = get_settings()
    directory = Path(settings.upload_dir) / "reports"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "VaniTitle",
            parent=base["Title"],
            textColor=colors.white,
            fontSize=22,
            leading=26,
            alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "VaniSubtitle",
            parent=base["Normal"],
            textColor=colors.white,
            fontSize=10,
            leading=13,
            alignment=TA_LEFT,
        ),
        "h2": ParagraphStyle(
            "VaniH2",
            parent=base["Heading2"],
            textColor=_VIOLET,
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "VaniBody",
            parent=base["Normal"],
            textColor=_INK,
            fontSize=9.5,
            leading=13,
        ),
        "muted": ParagraphStyle(
            "VaniMuted",
            parent=base["Normal"],
            textColor=_MUTED,
            fontSize=8.5,
            leading=11,
        ),
        "cell": ParagraphStyle(
            "VaniCell",
            parent=base["Normal"],
            textColor=_INK,
            fontSize=9,
            leading=12,
        ),
    }


class _BrandHeader(Flowable):
    """A full-width violet→blue gradient-style band with the VaniAI wordmark."""

    def __init__(self, title: str, subtitle: str, width: float, height: float = 2.4 * cm) -> None:
        super().__init__()
        self.title = title
        self.subtitle = subtitle
        self.width = width
        self.height = height

    def wrap(self, avail_width: float, avail_height: float) -> tuple[float, float]:
        self.width = avail_width
        return self.width, self.height

    def draw(self) -> None:
        canvas = self.canv
        # Approximate the violet→blue gradient with vertical strips.
        strips = 60
        for i in range(strips):
            ratio = i / (strips - 1)
            red = _VIOLET.red + (_BLUE.red - _VIOLET.red) * ratio
            green = _VIOLET.green + (_BLUE.green - _VIOLET.green) * ratio
            blue = _VIOLET.blue + (_BLUE.blue - _VIOLET.blue) * ratio
            canvas.setFillColorRGB(red, green, blue)
            x = self.width * i / strips
            canvas.rect(x, 0, self.width / strips + 1, self.height, stroke=0, fill=1)

        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 24)
        canvas.drawString(0.6 * cm, self.height - 1.0 * cm, "VaniAI")
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawString(0.6 * cm, self.height - 1.7 * cm, self.title)
        canvas.setFont("Helvetica", 9)
        canvas.drawString(0.6 * cm, self.height - 2.15 * cm, self.subtitle)


def _readiness_chart(readiness: dict[str, Any], width: float = 16 * cm) -> Drawing:
    """A labelled vertical bar chart of the five readiness dimensions."""
    dimensions = ["academic", "technical", "communication", "industry", "overall"]
    values = [float(readiness.get(dim, 0.0)) for dim in dimensions]

    drawing = Drawing(width, 6.4 * cm)
    chart = VerticalBarChart()
    chart.x = 1.2 * cm
    chart.y = 1.0 * cm
    chart.width = width - 2.4 * cm
    chart.height = 4.4 * cm
    chart.data = [values]
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    chart.valueAxis.valueStep = 20
    chart.categoryAxis.categoryNames = [
        "Academic",
        "Technical",
        "Comm.",
        "Industry",
        "Overall",
    ]
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.labels.fontSize = 8
    chart.bars[0].fillColor = _VIOLET
    chart.barWidth = 0.6 * cm
    chart.groupSpacing = 0.5 * cm
    drawing.add(chart)

    # Value labels above each bar.
    step = chart.width / len(values)
    for index, value in enumerate(values):
        label_x = chart.x + step * (index + 0.5)
        label_y = chart.y + chart.height * (value / 100.0) + 4
        drawing.add(
            String(label_x, label_y, f"{value:.0f}", fontSize=8, fillColor=_INK, textAnchor="middle")
        )
    return drawing


def _table(data: list[list[Any]], *, col_widths: list[float] | None = None) -> Table:
    table = Table(data, colWidths=col_widths, hAlign="LEFT")
    style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), _VIOLET),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 1), (-1, -1), _INK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LIGHT_ROW]),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, _BLUE),
            ("GRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ]
    )
    table.setStyle(style)
    return table


def _priority_color(priority: str) -> colors.Color:
    return {"high": _CRIT, "medium": _WARN, "low": _GOOD}.get(priority, _MUTED)


def _fmt(value: float | None, *, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    return f"{value:.1f}{suffix}"


def _fmt_pct(probability: float | None) -> str:
    if probability is None:
        return "N/A"
    return f"{probability * 100:.1f}%"


def _build_pdf(file_path: Path, title: str, subtitle: str, body: list[Flowable]) -> None:
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.5 * cm,
        title=title,
        author="VaniAI",
    )
    content_width = doc.width
    story: list[Flowable] = [_BrandHeader(title, subtitle, content_width), Spacer(1, 0.5 * cm)]
    story.extend(body)

    styles = _styles()
    footer_style = styles["muted"]
    footer_style.alignment = TA_CENTER

    def _on_page(canvas: Any, _doc: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(_MUTED)
        canvas.drawCentredString(
            A4[0] / 2,
            1.0 * cm,
            f"VaniAI — Placement Prediction & Career Readiness  |  Generated "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Page {_doc.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)


# --------------------------------------------------------------------------------------
# Student report
# --------------------------------------------------------------------------------------


def generate_student_report(db: Session, *, student_id: int, generated_by: int) -> GeneratedReport:
    """Generate the individual student career-readiness report."""
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")
    user = db.get(User, student.user_id)
    full_name = user.full_name if user is not None else "Student"

    styles = _styles()
    profile = build_student_profile(db, student_id)

    repo = PredictionRepository(db)
    prediction = repo.get_latest_for_student(student_id)

    body: list[Flowable] = []

    # Profile table.
    body.append(Paragraph("Student Profile", styles["h2"]))
    body.append(
        _table(
            [
                ["Field", "Value"],
                ["Name", full_name],
                ["Register Number", student.register_number],
                ["Department", student.department],
                ["Batch", student.batch],
                ["Semester", str(student.semester)],
            ],
            col_widths=[6 * cm, 10 * cm],
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    # Scores table.
    body.append(Paragraph("Academic & Skill Scores", styles["h2"]))
    body.append(
        _table(
            [
                ["Metric", "Score"],
                ["CGPA", _fmt(profile["cgpa"])],
                ["10th %", _fmt(profile["tenth_percentage"])],
                ["12th %", _fmt(profile["twelfth_percentage"])],
                ["Attendance %", _fmt(profile["attendance_percentage"])],
                ["Coding", _fmt(profile["coding_score"])],
                ["Aptitude", _fmt(profile["aptitude_score"])],
                ["Communication", _fmt(profile["communication_score"])],
                ["Technical Skill", _fmt(profile["technical_skill_score"])],
                ["Leadership", _fmt(profile["leadership_score"])],
                ["Resume Score", _fmt(profile["resume_score"])],
                ["Mock Interview", _fmt(profile["mock_interview_score"])],
                ["Internships", str(profile["internship_count"])],
                ["Projects", str(profile["project_count"])],
                ["Certifications", str(profile["certification_count"])],
                ["Hackathons", str(profile["hackathon_count"])],
            ],
            col_widths=[6 * cm, 10 * cm],
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    # Readiness breakdown + chart + prediction summary.
    if prediction is not None:
        readiness = dict(prediction.readiness)
        body.append(Paragraph("Career Readiness Breakdown", styles["h2"]))
        body.append(_readiness_chart(readiness, width=16 * cm))
        body.append(Spacer(1, 0.2 * cm))

        body.append(Paragraph("Prediction Summary", styles["h2"]))
        body.append(
            _table(
                [
                    ["Metric", "Value"],
                    ["Placement Probability", _fmt_pct(prediction.placement_probability)],
                    ["Risk Level", prediction.risk_level.title()],
                    ["Overall Readiness", _fmt(readiness.get("overall"))],
                    ["Model Version", prediction.model_version],
                    [
                        "Generated At",
                        prediction.created_at.strftime("%Y-%m-%d %H:%M"),
                    ],
                ],
                col_widths=[6 * cm, 10 * cm],
            )
        )
        body.append(Spacer(1, 0.25 * cm))

        reasons = [str(r) for r in (prediction.risk_reasons or [])]
        if reasons:
            body.append(Paragraph("Key Observations", styles["h2"]))
            for reason in reasons:
                body.append(Paragraph(f"• {reason}", styles["body"]))
            body.append(Spacer(1, 0.25 * cm))

        recommendations = repo.get_recommendations_for_prediction(prediction.id)
        if recommendations:
            body.append(Paragraph("Recommendations", styles["h2"]))
            rec_rows: list[list[Any]] = [["Priority", "Category", "Recommendation"]]
            for rec in recommendations:
                priority_para = Paragraph(
                    f'<font color="#{_priority_color(rec.priority).hexval()[2:]}">'
                    f"<b>{rec.priority.title()}</b></font>",
                    styles["cell"],
                )
                rec_rows.append(
                    [priority_para, rec.category.title(), Paragraph(rec.text, styles["cell"])]
                )
            body.append(_table(rec_rows, col_widths=[2.5 * cm, 3.5 * cm, 10 * cm]))
    else:
        body.append(
            Paragraph(
                "No prediction has been generated for this student yet. Run a "
                "prediction to populate readiness, risk, and recommendation details.",
                styles["muted"],
            )
        )

    filename = f"student_report_{student.register_number}.pdf"
    stored_path = _reports_dir() / f"student_{student_id}_{uuid.uuid4().hex}.pdf"
    _build_pdf(stored_path, "Student Career Readiness Report", full_name, body)

    report = ReportRepository(db).create(
        student_id=student_id,
        report_type="student",
        file_path=str(stored_path),
        generated_by=generated_by,
    )
    db.commit()

    return GeneratedReport(file_path=str(stored_path), filename=filename, report_id=report.id)


# --------------------------------------------------------------------------------------
# Department report
# --------------------------------------------------------------------------------------


def generate_department_report(
    db: Session, *, department: str, generated_by: int
) -> GeneratedReport:
    """Generate an aggregate report for a single department."""
    if department not in DEPARTMENTS:
        raise ValidationError(f"Unknown department '{department}'")

    styles = _styles()
    snapshots = analytics_service.load_snapshots(db, department=department)
    skill_analytics = analytics_service.skill_analytics(db, department=department)

    probabilities = [
        s.placement_probability for s in snapshots if s.placement_probability is not None
    ]
    readiness_values = [
        s.readiness_overall for s in snapshots if s.readiness_overall is not None
    ]
    ready_count = sum(
        1 for p in probabilities if p >= analytics_service.READY_PROBABILITY_THRESHOLD
    )
    at_risk_count = sum(1 for s in snapshots if s.risk_level == "high")

    body: list[Flowable] = []
    body.append(Paragraph(f"{department} Department Overview", styles["h2"]))
    body.append(
        _table(
            [
                ["Metric", "Value"],
                ["Total Students", str(len(snapshots))],
                ["Placement Ready (≥70%)", str(ready_count)],
                ["High Risk", str(at_risk_count)],
                [
                    "Average Probability",
                    _fmt_pct(
                        sum(probabilities) / len(probabilities) if probabilities else None
                    ),
                ],
                [
                    "Average Readiness",
                    _fmt(
                        sum(readiness_values) / len(readiness_values)
                        if readiness_values
                        else None
                    ),
                ],
            ],
            col_widths=[7 * cm, 9 * cm],
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    # Skill averages as a readiness-style chart reuse.
    skill_avgs = skill_analytics["skill_averages"]
    body.append(Paragraph("Average Skill Scores", styles["h2"]))
    body.append(
        _readiness_chart(
            {
                "academic": skill_avgs["coding"],
                "technical": skill_avgs["technical"],
                "communication": skill_avgs["communication"],
                "industry": skill_avgs["aptitude"],
                "overall": skill_avgs["leadership"],
            },
            width=16 * cm,
        )
    )
    # Relabel legend via a small table because chart categories are fixed above.
    body.append(
        _table(
            [
                ["Coding", "Technical", "Communication", "Aptitude", "Leadership"],
                [
                    _fmt(skill_avgs["coding"]),
                    _fmt(skill_avgs["technical"]),
                    _fmt(skill_avgs["communication"]),
                    _fmt(skill_avgs["aptitude"]),
                    _fmt(skill_avgs["leadership"]),
                ],
            ],
            col_widths=[3.2 * cm] * 5,
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    # Risk breakdown table.
    risk_dist = {"low": 0, "medium": 0, "high": 0}
    for snap in snapshots:
        if snap.risk_level in risk_dist:
            risk_dist[snap.risk_level] += 1
    body.append(Paragraph("Risk Distribution", styles["h2"]))
    body.append(
        _table(
            [
                ["Risk Level", "Students"],
                ["Low", str(risk_dist["low"])],
                ["Medium", str(risk_dist["medium"])],
                ["High", str(risk_dist["high"])],
            ],
            col_widths=[7 * cm, 9 * cm],
        )
    )

    filename = f"department_report_{department}.pdf"
    stored_path = _reports_dir() / f"department_{department}_{uuid.uuid4().hex}.pdf"
    _build_pdf(
        stored_path,
        "Department Placement Report",
        f"{department} Department",
        body,
    )

    report = ReportRepository(db).create(
        student_id=None,
        report_type="department",
        file_path=str(stored_path),
        generated_by=generated_by,
    )
    db.commit()

    return GeneratedReport(file_path=str(stored_path), filename=filename, report_id=report.id)


# --------------------------------------------------------------------------------------
# Placement report
# --------------------------------------------------------------------------------------


def generate_placement_report(db: Session, *, generated_by: int) -> GeneratedReport:
    """Generate the institution-wide placement dashboard report."""
    styles = _styles()
    dashboard = analytics_service.placement_dashboard(db)

    body: list[Flowable] = []
    body.append(Paragraph("Institution Placement Summary", styles["h2"]))
    body.append(
        _table(
            [
                ["Metric", "Value"],
                ["Total Students", str(dashboard["total_students"])],
                ["Placement Ready (≥70%)", str(dashboard["placement_ready_count"])],
                ["Average Probability", _fmt_pct(dashboard["average_probability"])],
                ["Low Risk", str(dashboard["risk_distribution"]["low"])],
                ["Medium Risk", str(dashboard["risk_distribution"]["medium"])],
                ["High Risk", str(dashboard["risk_distribution"]["high"])],
            ],
            col_widths=[7 * cm, 9 * cm],
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    # Department comparison table.
    body.append(Paragraph("Department Comparison", styles["h2"]))
    dept_rows: list[list[Any]] = [
        ["Department", "Students", "Ready", "Avg Prob.", "Avg Readiness"]
    ]
    for row in dashboard["department_comparison"]:
        dept_rows.append(
            [
                row["department"],
                str(row["student_count"]),
                str(row["ready_count"]),
                _fmt_pct(row["average_probability"]),
                _fmt(row["average_readiness"]),
            ]
        )
    body.append(
        _table(dept_rows, col_widths=[3.6 * cm, 2.6 * cm, 2.4 * cm, 3.4 * cm, 4 * cm])
    )
    body.append(Spacer(1, 0.35 * cm))

    # Top skills table.
    body.append(Paragraph("Cohort Skill Averages", styles["h2"]))
    skill_rows: list[list[Any]] = [["Skill", "Average"]]
    for item in dashboard["top_skills"]:
        skill_rows.append([str(item["skill"]).title(), _fmt(item["average"])])
    body.append(_table(skill_rows, col_widths=[8 * cm, 8 * cm]))
    body.append(Spacer(1, 0.35 * cm))

    # Common weak skills.
    body.append(Paragraph("Common Weak Skills (below target)", styles["h2"]))
    weak_rows: list[list[Any]] = [["Skill", "Students Below Target"]]
    for item in dashboard["common_weak_skills"]:
        weak_rows.append([str(item["skill"]).title(), str(item["students_below_target"])])
    body.append(_table(weak_rows, col_widths=[8 * cm, 8 * cm]))

    filename = "placement_report.pdf"
    stored_path = _reports_dir() / f"placement_{uuid.uuid4().hex}.pdf"
    _build_pdf(
        stored_path,
        "Placement Analytics Report",
        "Institution-wide summary",
        body,
    )

    report = ReportRepository(db).create(
        student_id=None,
        report_type="placement",
        file_path=str(stored_path),
        generated_by=generated_by,
    )
    db.commit()

    return GeneratedReport(file_path=str(stored_path), filename=filename, report_id=report.id)
