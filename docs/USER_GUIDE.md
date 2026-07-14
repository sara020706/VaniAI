# User Guide

A walkthrough of every VaniAI feature, organized by role: [Student](#3-student-guide), [Faculty](#4-faculty-guide), [Placement Officer](#5-placement-officer-guide), and [Admin](#6-admin-guide).

URLs below assume the Docker frontend at `http://localhost:3000` (with the Vite dev server, use `http://localhost:5173`).

---

## 1. Signing in

Open the app and log in at `/login`. If the demo data has been seeded ([Installation §2.2](INSTALLATION.md#22-seed-demo-data)), these accounts exist:

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@vaniai.io` | `Admin@123` | `/admin` |
| Faculty | `faculty@vaniai.io` | `Faculty@123` | `/faculty` |
| Placement Officer | `placement@vaniai.io` | `Placement@123` | `/placement` |
| Student | `student@vaniai.io` | `Student@123` | `/student` |

After login you are redirected to your role's home page automatically, and the sidebar only shows the pages your role can access. Sessions refresh silently in the background; **Logout** (user menu, top-right) ends the session on the server too.

**Self-registration** (`/register`) creates **student** accounts only — you'll need your email, a password (minimum 8 characters), full name, register number, department (`CSE`, `IT`, `ECE`, `EEE`, `MECH`, `CIVIL`), batch (e.g. `2026`), and semester. Faculty, placement officer, and admin accounts are created by an admin (see [§6.2](#62-users--adminusers)).

### Finding your way around

- **Sidebar** (collapsible): your role's pages. **Topbar**: page title, light/dark theme toggle, user menu.
- **Score rings and badges** are color-banded everywhere: green = good (score ≥ 70), amber = warning (40–70), red = critical (< 40). Risk badges always pair an icon and label with the color, so nothing depends on color alone.
- Data views show loading skeletons while fetching, a retry button on errors, and helpful empty states (e.g. "No prediction yet — run one") when there's nothing to display.

---

## 2. Understanding the numbers

These concepts appear across all roles.

### Placement probability
The model's estimated probability (shown as a percent) that the student will be placed, based on 15 profile signals: CGPA, 10th/12th percentages, attendance, five skill scores (coding, aptitude, communication, technical, leadership), counts of internships/projects/certifications/hackathons, resume score, and mock interview score.

### Risk level
Derived from the probability:

| Badge | Probability | Meaning |
|---|---|---|
| Low risk | ≥ 70% | On track — reasons list the student's strengths |
| Medium risk | 40–70% | Needs targeted improvement |
| High risk | < 40% | Needs intervention |

Each prediction includes plain-language **risk reasons** — the specific weak signals (e.g. CGPA below 6.5, attendance below 75%, coding score below 50, no internships, resume score below 60).

### Readiness scores (0–100)
Four dimensions plus an overall score:

| Dimension | Driven by |
|---|---|
| Academic | CGPA (40%), 10th, 12th, attendance (20% each) |
| Technical | Coding score, technical skills, project count, certifications |
| Communication | Communication score (50%), mock interview (30%), leadership (20%) |
| Industry | Internships, hackathons, resume score, aptitude |
| **Overall** | 30% academic + 30% technical + 20% communication + 20% industry |

### Explanation (why this prediction?)
Every prediction is explained with SHAP: the signed **top positive** and **top negative** factors (up to 5 each — what pushed the probability up or down, drawn as blue/red horizontal bars) and an overall **feature importance** ranking.

### Skill gaps
Current vs. target for weak areas (targets: 70 for coding/communication/aptitude scores, 60 for resume score, plus industry exposure), each with a gap size and severity (high/medium/low).

### Recommendations & career matches
Each prediction generates 4–8 prioritized, concrete actions (categories: coding, aptitude, communication, resume, academics, experience, certification, interview — weakest areas first) and the **top 5 career matches** from: Software Engineer, Data Scientist, ML Engineer, Cloud Engineer, Business Analyst, Cyber Security Analyst, Data Engineer — each with a 0–100 match score and reasons.

> **Note — "heuristic" model:** before the first training run the platform serves a deterministic rule-based fallback (`heuristic-v0`). Everything works, but predictions are rule-based, not learned. Admins see a warning until a trained model is deployed.

---

## 3. Student guide

| Page | Route |
|---|---|
| Dashboard | `/student` |
| Profile | `/student/profile` |
| Resume | `/student/resume` |
| Progress | `/student/progress` |
| Reports | `/student/reports` |

### 3.1 Dashboard — `/student`

Your placement readiness at a glance:

- **Stat cards**: placement probability (with a score ring), overall readiness, resume score, and mock interview score.
- **Run Prediction** button — executes the full pipeline against your *current* profile and refreshes everything below. Run it again after any meaningful profile update.
- **Trend chart** of your probability and readiness across past predictions.
- **Skill radar** of your five skill scores.
- **Prediction factors** chart (signed SHAP): blue bars raised your probability, red bars lowered it.
- **Skill gaps** list — current vs. target with severity.
- **Recommendations** timeline with priority badges — your ordered to-do list.
- **Career matches** — top 5 roles with match scores and reasons.

New account? The dashboard shows an empty state until you complete your profile and run your first prediction.

### 3.2 Profile — `/student/profile`

The single source the model reads. Sections:

- **Personal** — name and basic details.
- **Academic** — CGPA (0–10), 10th %, 12th %, attendance %.
- **Skills** — self-assessed 0–100 scores: coding, aptitude, communication, technical, leadership.
- **Experience lists** — add/remove **projects** (title, description, tech stack, URL), **internships** (company, role, duration in months), **certifications** (name, issuer, date, credential URL), and **hackathons** (name, position, date).

All forms validate before saving. Saving academic or skill changes appends a dated snapshot — that history powers your Progress page, so update honestly and regularly rather than in one big batch. Interview scores are entered by faculty ([§4.5](#45-interview-scores--facultyinterviews)); your resume score comes from the Resume page.

### 3.3 Resume — `/student/resume`

Drag-and-drop (or browse to) your resume as a **PDF, max 5 MB**. The analyzer returns:

- **Resume score** (0–100): section coverage (40%), skill breadth (30%), quantified achievements and action verbs (15%), length/format (15%).
- **ATS score** (0–100): how well applicant-tracking systems can parse it — text extractability, standard section headers, contact info, layout heuristics.
- **Extracted content** chips (skills, projects, experience, education), **missing sections**, and concrete **suggestions**.

The latest resume score feeds your next prediction — re-upload after improving your resume, then re-run the prediction.

### 3.4 Progress — `/student/progress`

Your history over time: an academic trend (CGPA and attendance snapshots), skill score trends, and your placement probability across predictions. Flat charts mean no new snapshots — the history grows each time you save changed academic/skill values or run a prediction.

### 3.5 Reports — `/student/reports`

Download your **PDF report** — profile, scores, readiness breakdown, latest prediction with risk reasons, and the recommendations table. Useful for mentoring sessions and applications.

---

## 4. Faculty guide

| Page | Route |
|---|---|
| Dashboard | `/faculty` |
| Students | `/faculty/students` |
| Student detail | `/faculty/students/:id` |
| Compare | `/faculty/compare` |
| Interview scores | `/faculty/interviews` |

### 4.1 Dashboard — `/faculty`

Cohort analytics with **department and batch filters** (leave blank for everyone):

- Stat cards: student count, average CGPA, average readiness, average probability, at-risk count.
- **Skill averages radar** — the cohort's average coding/aptitude/communication/technical/leadership scores.
- **Risk donut** — low/medium/high distribution with counts.
- **Top performers** and **weak students** tables (5 each) — click through to detail pages.

### 4.2 Students — `/faculty/students`

The full directory: search by name/register number, filter by department, batch, and risk level; paginated table showing CGPA, placement probability, readiness, and risk badge (blank until a student has a prediction). Click a row to open the detail page.

### 4.3 Student detail — `/faculty/students/:id`

Everything about one student: profile, academic/skill/experience data, latest prediction with explanation and recommendations, progress charts — and a **Run Prediction** button to generate a fresh prediction for them (e.g. after they update their profile or you enter an interview score).

### 4.4 Compare — `/faculty/compare`

Select **2–4 students** for a side-by-side view: an overlaid skill radar plus a comparison table of scores, readiness, probability, and risk. Ideal for shortlisting or spotting why similar students diverge.

### 4.5 Interview scores — `/faculty/interviews`

Record mock interview results: pick the student, enter a **score (0–100)**, a **confidence level** (`low` / `medium` / `high`), and optional notes. You immediately get back an **interview readiness** result (60% mock score + 25% communication + 15% aptitude) with suggestions to pass on to the student. The score becomes part of the student's profile and influences their next prediction.

---

## 5. Placement officer guide

| Page | Route |
|---|---|
| Dashboard | `/placement` |
| At-risk students | `/placement/at-risk` |
| Departments | `/placement/departments` |

### 5.1 Dashboard — `/placement`

The institution-wide placement picture:

- Stat cards: total students, **placement-ready count** (probability ≥ 70%), average probability.
- **Probability distribution** — students bucketed `0-10%` … `90-100%`; healthy cohorts skew right.
- **Department comparison** — average probability and readiness per department.
- **Risk donut** — overall low/medium/high split.
- **Top skills** and **common weak skills** — where the cohort is strong, and which skills have the most students below target (your training-program shortlist).
- **Risk heatmap** — department × batch grid shaded by high-risk share; dark cells show exactly where to focus intervention.

### 5.2 At-risk students — `/placement/at-risk`

A paginated list of every at-risk student **with their specific risk reasons** — so outreach can be concrete ("attendance below 75%, no internships") rather than generic. The **Export CSV** button downloads the student list (register number, department, batch, CGPA, probability, readiness, risk) for spreadsheets or mail-merge.

### 5.3 Departments — `/placement/departments`

Per-department analytics: comparison chart plus a table of student count, average CGPA, average probability, average readiness, ready count, and at-risk count — with a **PDF report download per department** for HoD reviews.

Placement officers can also open the student directory and individual student profiles, and download the overall **placement report** PDF.

---

## 6. Admin guide

| Page | Route |
|---|---|
| Dashboard | `/admin` |
| Users | `/admin/users` |
| Datasets | `/admin/datasets` |
| Models | `/admin/models` |
| Monitoring | `/admin/monitoring` |

### 6.1 Dashboard — `/admin`

System health at a glance: API and database status, **active model version** (with a prominent warning if the heuristic fallback `heuristic-v0` is serving), active model metrics, recent training history, and current drift status.

### 6.2 Users — `/admin/users`

Manage all accounts: search, filter by role, **create users of any role** (this is how faculty/placement officer/admin accounts are made), edit name/role/password, and **activate/deactivate**. Deactivation is a soft delete — the account can no longer log in, but its data remains.

### 6.3 Datasets — `/admin/datasets`

Upload training CSVs. Each upload is validated instantly and gets a status badge: `uploaded` → `validated` (ready to train) or `invalid` (with the exact validation errors listed); `used` marks datasets a model was trained on. Required columns: the 15 feature columns plus the `placed` (0/1) target — see [MLOPS.md §3](MLOPS.md#3-stage-12-dataset-upload-and-validation).

### 6.4 Models — `/admin/models`

The training and deployment center:

- **Start Training** on any validated dataset — training runs in the background; the page polls every 5 seconds until the run completes.
- **Training history** — every experiment with model type, parameters, metrics (accuracy, precision, recall, F1, ROC-AUC), status, and timings.
- **Model versions** — the registry (`v1`, `v2`, …) with metrics and the active flag. **Deploy** activates any version instantly (hot reload, no restart) — which is also your one-click rollback.
- **Trigger Retraining** — retrains on the latest used dataset; typically used after a drift alert.

A newly trained model is activated automatically; compare its ROC-AUC against the previous version and roll back if it regressed.

### 6.5 Monitoring — `/admin/monitoring`

Model and data health:

- **Data drift** — share of drifted features (meter) and chips naming exactly which features drifted (reference training data vs. recent prediction inputs).
- **Prediction drift (PSI)** — output distribution stability; PSI above 0.2 flags drift.
- **Run drift check** button — executes both checks now and stores the result; the **history table** tracks checks over time.
- Link to **Grafana** (http://localhost:3001) for request rates, latency, prediction throughput, probability distribution, and drift trends.

Suggested weekly routine: run a drift check → if drift is flagged and enough new data has accumulated, upload a fresh dataset (or Trigger Retraining) → verify the new version's metrics → confirm it's active. Full policy: [MLOPS.md §11](MLOPS.md#11-retraining-policy).

---

## 7. Tips & FAQ

**A student's probability seems stale.** Predictions are point-in-time snapshots. Update the profile (or resume/interview score), then click **Run Prediction** — on the student dashboard or the faculty student-detail page.

**Why do two students with similar CGPA get different probabilities?** CGPA is 1 of 15 signals. Open the prediction-factors chart (SHAP) on either profile — it shows exactly which factors separated them.

**Prediction fields are blank in lists.** That student has never had a prediction run. Faculty can run one from the student detail page.

**Uploads fail.** Resumes must be PDF and at most 5 MB. Dataset CSVs must contain all required columns — the Datasets page lists the exact validation errors.

**"Fallback model" warning on admin pages.** No trained model is deployed yet. Seed the demo data or upload a dataset and start training ([§6.3](#63-datasets--admindatasets)–[§6.4](#64-models--adminmodels)).

**Dark mode.** Toggle in the topbar; every page and chart adapts.

---

See also: [Installation](INSTALLATION.md) · [API Reference](API.md) · [MLOps](MLOPS.md) · [Architecture](ARCHITECTURE.md)
