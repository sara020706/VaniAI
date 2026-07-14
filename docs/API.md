# API Reference

Base URL: `http://localhost:8000/api/v1` (all endpoints below are relative to this prefix unless noted).

Interactive documentation with live request execution and full request/response schemas is always available at **`http://localhost:8000/docs`** (Swagger UI, generated from the running code). This page is the human-readable map; `/docs` is the executable truth.

---

## 1. Conventions

| Concern | Convention |
|---|---|
| Auth | `Authorization: Bearer <access_token>` header (JWT) |
| Content type | `application/json` except file uploads (`multipart/form-data`) and file downloads (PDF/CSV) |
| Naming | snake_case in all request and response bodies |
| IDs | integer autoincrement |
| Timestamps | ISO-8601, timezone-aware UTC |
| Probabilities | floats `0–1` (frontend renders as percent) |
| Scores | floats `0–100`; CGPA is `0–10` |
| Roles | `student` \| `faculty` \| `placement_officer` \| `admin` |
| Departments | `CSE` \| `IT` \| `ECE` \| `EEE` \| `MECH` \| `CIVIL` |
| Risk levels | `low` \| `medium` \| `high` |

### Pagination

List endpoints accept `?page=1&page_size=20` and respond with:

```json
{ "items": [], "total": 137, "page": 1, "page_size": 20 }
```

### Errors

FastAPI's default envelope everywhere:

```json
{ "detail": "Student not found" }
```

| Status | Meaning |
|---|---|
| 401 | Missing/expired/invalid token |
| 403 | Authenticated but role not allowed (or student accessing another student's data) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email / register number) |
| 422 | Validation error — FastAPI's standard shape with a `detail` array of field errors |

Unprefixed utility endpoints: `GET /health` (liveness) and `GET /metrics` (Prometheus exposition).

---

## 2. Authentication flow

1. **Register** (`POST /auth/register`) creates a *student* user plus an empty student profile. Faculty/placement/admin accounts are created by an admin via `/admin/users`.
2. **Login** (`POST /auth/login`) returns an **access token** (30 min) and a **refresh token** (7 days) plus the user object.
3. Send the access token as `Authorization: Bearer <token>` on every request.
4. When the access token expires (401), call **`POST /auth/refresh`** with the refresh token. Refresh tokens are stored server-side as sha256 hashes and are **rotated on every refresh** — the old refresh token is invalidated and the response carries a new pair.
5. **Logout** (`POST /auth/logout`) revokes the presented refresh token.

JWT claims: `sub` (user id as string), `role`, `type` (`"access"` | `"refresh"`), `exp`.

### `/auth` endpoints

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| POST | `/auth/register` | public | Register a student: `{email, password, full_name, register_number, department, batch, semester}` → 201 `UserOut` |
| POST | `/auth/login` | public | `{email, password}` → `{access_token, refresh_token, token_type: "bearer", user}` |
| POST | `/auth/refresh` | public (needs valid refresh token) | `{refresh_token}` → same shape as login (rotated pair) |
| POST | `/auth/logout` | 🔒 any | `{refresh_token}` → `{"detail": "Logged out"}` (revokes it) |
| GET | `/auth/me` | 🔒 any | Current user → `UserOut = {id, email, full_name, role, is_active, created_at}` |

---

## 3. Students — `/students`

Access rule: faculty, placement officers, and admins can read any student; students can only read/write **their own** data.

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| GET | `/students/me` | 🔒 student | Own full profile → `StudentOut` |
| PUT | `/students/me` | 🔒 student | Update profile; appends new academic/skill snapshot records when those values change → `StudentOut` |
| GET | `/students` | 🔒 faculty, placement_officer, admin | Paginated list; filters `department`, `batch`, `risk_level`, `search` → `Page[StudentListItem]` |
| GET | `/students/{student_id}` | 🔒 any (student: self only) | Full profile → `StudentOut` |
| GET | `/students/{student_id}/progress` | 🔒 any (student: self only) | `{academic_history, skill_history, prediction_history}` time series |
| POST | `/students/me/projects` | 🔒 student | Add a project (same pattern for `internships`, `certifications`, `hackathons`) |
| DELETE | `/students/me/projects/{item_id}` | 🔒 student | Remove a project (same pattern for the other three sub-resources) |

`StudentOut` bundles profile, latest `academic` and `skills` snapshots, `experience` (counts + item lists), `professional` (resume_score, mock_interview_score), and `latest_prediction` (or `null`).

`StudentListItem = {id, full_name, register_number, department, batch, semester, cgpa, placement_probability, readiness_overall, risk_level}` — prediction-derived fields are `null` until a prediction has run.

---

## 4. Faculty — `/faculty`

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| GET | `/faculty/analytics` | 🔒 faculty, admin | Cohort analytics (optional `department`, `batch` query): counts, averages, skill averages, top performers, weak students, risk distribution |
| GET | `/faculty/compare?student_ids=1,2,3` | 🔒 faculty, placement_officer, admin | Side-by-side comparison → `{students: [StudentListItem + skills + readiness]}` |
| POST | `/faculty/interview-scores` | 🔒 faculty, admin | Record a mock interview: `{student_id, mock_interview_score, confidence_level, notes?}` → result incl. `interview_readiness` (`0.6·mock + 0.25·communication + 0.15·aptitude`) with suggestions |

---

## 5. Predictions — `/predictions`

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| POST | `/predictions/students/{student_id}` | 🔒 any (student: self only) | Run the full pipeline (features → model → readiness → risk → SHAP → recommendations → careers), persist, and return `PredictionOut` |
| GET | `/predictions/students/{student_id}/latest` | 🔒 any (student: self only) | Latest `PredictionOut`, 404 if none |
| GET | `/predictions/students/{student_id}/history` | 🔒 any (student: self only) | `[{id, created_at, placement_probability, risk_level, readiness_overall, model_version}]` |

`PredictionOut`:

```json
{
  "id": 991, "student_id": 42, "model_version": "v3", "created_at": "2026-07-07T09:14:02Z",
  "placement_probability": 0.78,
  "risk_level": "low",
  "risk_reasons": ["Strong CGPA of 8.4", "Consistent attendance above 85%"],
  "readiness": {"academic": 81.2, "technical": 74.5, "communication": 68.0, "industry": 62.3, "overall": 73.4},
  "explanation": {
    "top_positive": [{"feature": "cgpa", "label": "CGPA", "impact": 0.14}],
    "top_negative": [{"feature": "internship_count", "label": "Internship Count", "impact": -0.06}],
    "feature_importance": [{"feature": "coding_score", "label": "Coding Score", "importance": 0.11}]
  },
  "skill_gaps": [{"skill": "communication", "current": 58.0, "target": 70.0, "gap": 12.0, "severity": "medium"}],
  "recommendations": [{"id": 4101, "category": "experience", "priority": "high", "text": "Apply for a summer internship…"}],
  "career_recommendations": [{"role": "Software Engineer", "match_score": 84.0, "reasons": ["Strong coding score"]}]
}
```

---

## 6. Resume — `/resume`

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| POST | `/resume/upload` | 🔒 student | Multipart `file` (PDF, max 5 MB) → analysis: `{id, filename, resume_score, ats_score, extracted, missing_sections, suggestions, created_at}` |
| GET | `/resume/students/{student_id}/latest` | 🔒 any (student: self only) | Latest analysis, 404 if none |

---

## 7. Placement — `/placement`

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| GET | `/placement/dashboard` | 🔒 placement_officer, admin | Cohort overview: totals, placement-ready count (prob ≥ 0.7), probability distribution buckets, department comparison, risk distribution, top skills, common weak skills, risk heatmap (department × batch) |
| GET | `/placement/at-risk` | 🔒 placement_officer, faculty, admin | Paginated `Page[AtRiskStudent]` (= `StudentListItem` + `risk_reasons`) |
| GET | `/placement/export` | 🔒 placement_officer, admin | CSV download (streaming) of student list rows |

---

## 8. Analytics — `/analytics`

All three require 🔒 faculty, placement_officer, or admin.

| Method | Path | Summary |
|---|---|---|
| GET | `/analytics/distributions` | Histograms (`"0-10"` … `"90-100"` buckets) for probability, readiness, resume_score + risk counts |
| GET | `/analytics/departments` | Per-department: student_count, average_cgpa, average_probability, average_readiness, ready_count, at_risk_count |
| GET | `/analytics/skills` | Optional `department` filter → skill averages + per-skill bucket distributions |

---

## 9. Reports — `/reports` (PDF downloads)

| Method | Path | Auth (roles) | Summary |
|---|---|---|---|
| GET | `/reports/students/{student_id}` | 🔒 any (student: self only) | Student PDF: profile, scores, readiness, prediction, recommendations table |
| GET | `/reports/department/{department}` | 🔒 faculty, placement_officer, admin | Department aggregate PDF |
| GET | `/reports/placement` | 🔒 placement_officer, admin | Placement dashboard aggregate PDF |

---

## 10. Admin — `/admin`

All require 🔒 admin.

| Method | Path | Summary |
|---|---|---|
| GET | `/admin/users` | Paginated users; filters `role`, `search` |
| POST | `/admin/users` | Create any-role user: `{email, password, full_name, role}` → `UserOut` |
| PUT | `/admin/users/{user_id}` | Update `{full_name?, role?, is_active?, password?}` |
| DELETE | `/admin/users/{user_id}` | Soft delete (`is_active = false`) |
| POST | `/admin/datasets/upload` | Multipart CSV → validated → `DatasetOut = {id, name, filename, row_count, status, validation_errors, created_at}` |
| GET | `/admin/datasets` | `Page[DatasetOut]` |
| POST | `/admin/training/start` | `{dataset_id}` → 202 `{experiment_id, status: "running"}` (background training) |
| GET | `/admin/training/history` | `Page[ExperimentOut]` (params, metrics, status, timings, mlflow_run_id) |
| GET | `/admin/models` | `[{id, version, model_type, metrics, is_active, created_at}]` |
| POST | `/admin/models/{version}/deploy` | Activate a version + hot-reload the predictor |
| POST | `/admin/retraining/trigger` | 202 — retrain on the latest used dataset |

---

## 11. Monitoring — `/monitoring`

All require 🔒 admin.

| Method | Path | Summary |
|---|---|---|
| GET | `/monitoring/health` | `{status, database, model_loaded, model_version, is_fallback, mlflow_configured, uptime_seconds}` |
| GET | `/monitoring/drift` | Latest data-drift + prediction-drift (PSI) results and check history |
| POST | `/monitoring/drift/run` | Run a drift check now (reference.csv vs recent prediction inputs), persist, return the same shape as GET |

---

## 12. Examples

### Login (curl)

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@vaniai.io", "password": "Student@123"}'
```

Response (abridged):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs…",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs…",
  "token_type": "bearer",
  "user": {"id": 4, "email": "student@vaniai.io", "full_name": "Demo Student", "role": "student", "is_active": true, "created_at": "2026-07-01T10:00:00Z"}
}
```

### Run a prediction (curl)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs…"   # access_token from login

# find your student id (students table id, not the user id)
curl -s http://localhost:8000/api/v1/students/me \
  -H "Authorization: Bearer $TOKEN"

# run the prediction pipeline
curl -s -X POST http://localhost:8000/api/v1/predictions/students/1 \
  -H "Authorization: Bearer $TOKEN"
```

### The same in PowerShell

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"student@vaniai.io","password":"Student@123"}'

$headers = @{ Authorization = "Bearer $($login.access_token)" }
$me = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/students/me" -Headers $headers

Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "http://localhost:8000/api/v1/predictions/students/$($me.id)"
```

### Refresh an expired session

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

---

For request/response schemas in full detail — including every field's type and optionality — use the live OpenAPI docs at **`/docs`** (or the raw spec at `/openapi.json`).
