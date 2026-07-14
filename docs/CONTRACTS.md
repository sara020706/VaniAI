# VaniAI — Build Contracts (Binding Spec)

This document is the **single source of truth** for every module of VaniAI, an
AI-powered Placement Prediction & Career Readiness Platform. All code MUST match
the names, routes, shapes, and conventions defined here exactly. If two documents
disagree, this one wins.

---

## 1. Stack

- **Frontend:** React 19, TypeScript, Vite 6, TailwindCSS 3.4, shadcn/ui-style components (Radix primitives), Framer Motion, React Hook Form + Zod, TanStack Query v5, Recharts 2, React Router v7, axios, lucide-react, sonner (toasts).
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (Mapped/DeclarativeBase style), PostgreSQL, Alembic, Pydantic v2 + pydantic-settings.
- **ML:** scikit-learn, XGBoost, pandas, numpy, SHAP, joblib.
- **MLOps:** MLflow, DVC, Docker, GitHub Actions, Evidently (==0.4.40), Prometheus (prometheus-fastapi-instrumentator), Grafana.

## 2. Repository layout & file ownership

```
VaniAI/
├── README.md                        [D1]
├── Makefile                         [O1]
├── .gitignore  .dockerignore        [O1]
├── docker-compose.yml               [O1]
├── .github/workflows/               [O1]  ci.yml, cd.yml, retrain.yml
├── docs/                            [D1]  INSTALLATION.md DEPLOYMENT.md ARCHITECTURE.md API.md MLOPS.md USER_GUIDE.md
│   └── CONTRACTS.md                 (this file — do not modify)
├── mlops/
│   ├── prometheus/prometheus.yml    [O1]
│   └── grafana/provisioning/...     [O1]  datasource + dashboard JSON
├── data/                            [M1]  .gitkeep, sample_students.csv
├── dvc.yaml  params.yaml            [M1]
├── backend/
│   ├── Dockerfile                   [O1]
│   ├── requirements.txt             [B1]
│   ├── .env.example                 [B1]
│   ├── alembic.ini  alembic/        [B1]  env.py, script.py.mako, versions/0001_initial.py
│   ├── pyproject.toml               [B1]  (ruff + pytest config)
│   ├── app/
│   │   ├── main.py                  [B1]
│   │   ├── core/                    [B1]  config.py database.py security.py logging_conf.py exceptions.py metrics.py
│   │   ├── models/                  [B1]  (all SQLAlchemy models, one file per domain)
│   │   ├── schemas/                 [B1]  (all Pydantic schemas)
│   │   ├── api/deps.py              [B1]
│   │   ├── api/v1/router.py         [B1]  (aggregates all routers below)
│   │   ├── api/v1/auth.py           [B2]
│   │   ├── api/v1/students.py       [B2]
│   │   ├── api/v1/faculty.py        [B2]
│   │   ├── api/v1/predictions.py    [B3]
│   │   ├── api/v1/resume.py         [B3]
│   │   ├── api/v1/placement.py      [B3]
│   │   ├── api/v1/analytics.py      [B3]
│   │   ├── api/v1/reports.py        [B3]
│   │   ├── api/v1/admin.py          [B4]
│   │   ├── api/v1/monitoring.py     [B4]
│   │   ├── repositories/            base.py user_repository.py student_repository.py [B2]
│   │   │                            prediction_repository.py resume_repository.py report_repository.py [B3]
│   │   │                            dataset_repository.py model_repository.py monitoring_repository.py [B4]
│   │   ├── services/                auth_service.py student_service.py faculty_service.py [B2]
│   │   │                            prediction_service.py resume_service.py recommendation_service.py
│   │   │                            report_service.py analytics_service.py [B3]
│   │   │                            dataset_service.py training_service.py monitoring_service.py [B4]
│   │   └── utils/                   [B2]  (shared helpers as needed)
│   ├── ml/
│   │   ├── config.py                [M1]
│   │   ├── data/                    [M1]  generate_dataset.py validation.py cleaning.py
│   │   ├── features/                [M1]  engineering.py
│   │   ├── training/                [M1]  train.py evaluate.py registry.py
│   │   ├── inference/               [M2]  predictor.py explainer.py readiness.py risk.py
│   │   ├── recommendation/          [M2]  engine.py career.py
│   │   ├── resume/                  [M2]  parser.py analyzer.py
│   │   └── monitoring/              [M2]  drift.py retraining.py
│   ├── scripts/seed.py              [B4]
│   └── tests/                       [B4]  conftest.py test_auth.py test_students.py test_predictions.py test_ml.py
└── frontend/
    ├── Dockerfile  nginx.conf       [O1]
    ├── package.json vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js index.html  [F1]
    ├── src/
    │   ├── main.tsx App.tsx index.css                    [F1]
    │   ├── types/index.ts                                [F1]
    │   ├── lib/  api-client.ts api.ts utils.ts constants.ts chart-colors.ts  [F1]
    │   ├── hooks/  use-auth.tsx use-theme.tsx            [F1]
    │   ├── components/ui/                                [F1]
    │   ├── components/layout/                            [F1]
    │   ├── components/shared/                            [F1]
    │   ├── components/charts/                            [F1]
    │   ├── pages/auth/LoginPage.tsx RegisterPage.tsx     [F1]
    │   ├── pages/student/                                [F2]  DashboardPage ProfilePage ResumePage ProgressPage ReportsPage
    │   ├── pages/faculty/                                [F3]  DashboardPage StudentsPage StudentDetailPage ComparePage InterviewScoresPage
    │   ├── pages/placement/                              [F3]  DashboardPage AtRiskPage DepartmentsPage
    │   └── pages/admin/                                  [F4]  DashboardPage UsersPage DatasetsPage ModelsPage MonitoringPage
```

Owner tags: B=backend, M=ml, F=frontend, O=infra, D=docs. **Write only files you own.**

## 3. Global conventions

- **API base path:** `/api/v1`. OpenAPI docs at `/docs`, health at `/health` (no prefix), Prometheus metrics at `/metrics`.
- **Roles:** `student` | `faculty` | `placement_officer` | `admin` (string enum, exactly these values).
- **Departments:** `CSE` | `IT` | `ECE` | `EEE` | `MECH` | `CIVIL`.
- **Risk levels:** `low` | `medium` | `high`.
- **IDs:** integer autoincrement primary keys.
- **Timestamps:** `created_at` / `updated_at` as timezone-aware UTC; serialized ISO-8601.
- **Errors:** FastAPI default envelope `{"detail": "<message>"}`; validation errors keep FastAPI's 422 shape.
- **Pagination:** query `?page=1&page_size=20` → response `{"items": [...], "total": int, "page": int, "page_size": int}`.
- **JSON naming:** snake_case everywhere (backend responses AND frontend TypeScript types — no camelCase mapping layer).
- **Probability:** floats 0–1 in API payloads; frontend renders as percent.
- **Scores:** 0–100 floats unless stated otherwise. CGPA is 0–10.

### Ports & services (docker-compose service names)

| Service | compose name | container port | host port |
|---|---|---|---|
| PostgreSQL 16 | `postgres` | 5432 | 5432 (db `vaniai`, user `vaniai`, password `vaniai`; second db `mlflow`) |
| FastAPI backend | `backend` | 8000 | 8000 |
| React frontend (nginx) | `frontend` | 80 | 3000 (nginx proxies `/api` → `backend:8000`) |
| MLflow server | `mlflow` | 5000 | 5000 |
| Prometheus | `prometheus` | 9090 | 9090 |
| Grafana | `grafana` | 3000 | 3001 |

### Backend environment variables (`backend/.env.example`, via pydantic-settings `Settings` in `app/core/config.py`)

```
DATABASE_URL=postgresql+psycopg2://vaniai:vaniai@localhost:5432/vaniai
SECRET_KEY=change-me-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
MODEL_DIR=./ml_artifacts
UPLOAD_DIR=./uploads
MLFLOW_TRACKING_URI=
ENVIRONMENT=development
AUTO_CREATE_TABLES=true
```

`MLFLOW_TRACKING_URI` empty ⇒ ML code logs to local `./mlruns` and must never crash if MLflow is unreachable (wrap logging in try/except). `AUTO_CREATE_TABLES=true` ⇒ `Base.metadata.create_all` on startup (dev convenience); Alembic migrations are the production path.

## 4. Authentication

- JWT (python-jose). Claims: `sub` = str(user.id), `role`, `type` (`"access"` | `"refresh"`), `exp`.
- Passwords: passlib bcrypt (`pwd_context = CryptContext(schemes=["bcrypt"])`); pin `bcrypt==4.0.1` in requirements for passlib compatibility.
- Refresh tokens are persisted **hashed (sha256)** in `refresh_tokens` table; rotated on every refresh; revoked on logout.
- `app/api/deps.py` provides: `get_db`, `get_current_user`, and `require_roles(*roles)` dependency factory. Placement officer/faculty/admin can read student data; students only their own (enforce in routers/services).

## 5. Database schema (SQLAlchemy models — B1; migration 0001 must match exactly)

- **users**: id, email (unique, indexed), hashed_password, full_name, role (str enum), is_active (bool, default true), created_at, updated_at
- **refresh_tokens**: id, user_id FK→users, token_hash (indexed), expires_at, revoked (bool default false), created_at
- **students**: id, user_id FK→users unique, register_number (unique), department, batch (str, e.g. "2026"), semester (int), created_at, updated_at
- **academic_records**: id, student_id FK, cgpa, tenth_percentage, twelfth_percentage, attendance_percentage, recorded_at
- **skill_records**: id, student_id FK, coding_score, aptitude_score, communication_score, technical_skill_score, leadership_score, recorded_at
- **projects**: id, student_id FK, title, description, tech_stack, url (nullable)
- **internships**: id, student_id FK, company, role, duration_months (int), description (nullable)
- **certifications**: id, student_id FK, name, issuer, issued_date (date, nullable), credential_url (nullable)
- **hackathons**: id, student_id FK, name, position (nullable), event_date (date, nullable)
- **resume_analyses**: id, student_id FK, filename, file_path, resume_score, ats_score, extracted (JSON), missing_sections (JSON), suggestions (JSON), created_at
- **interview_scores**: id, student_id FK, mock_interview_score, confidence_level (str: `low`|`medium`|`high`), notes (nullable), entered_by FK→users, created_at
- **predictions**: id, student_id FK, model_version (str), placement_probability (float), risk_level (str), risk_reasons (JSON list[str]), readiness (JSON), explanation (JSON), created_at
- **recommendations**: id, prediction_id FK, student_id FK, category (str), priority (str: `high`|`medium`|`low`), text, status (str default `"active"`), created_at
- **reports**: id, student_id FK nullable, report_type (str: `student`|`faculty`|`placement`|`department`), file_path, generated_by FK→users, created_at
- **datasets**: id, name, filename, file_path, row_count (int), status (str: `uploaded`|`validated`|`invalid`|`used`), validation_errors (JSON, nullable), uploaded_by FK→users, created_at
- **experiments**: id, mlflow_run_id (nullable), dataset_id FK nullable, model_type (str), params (JSON), metrics (JSON), status (str: `running`|`completed`|`failed`), started_at, finished_at (nullable)
- **model_versions**: id, version (str, unique, e.g. "v3"), model_type, metrics (JSON), mlflow_run_id (nullable), artifact_path, is_active (bool), created_at
- **monitoring_logs**: id, metric_type (str: `data_drift`|`prediction_drift`|`system`), payload (JSON), drift_detected (bool default false), created_at

Latest academic/skill record per student = the current values. Progress graphs use the record history ordered by `recorded_at`.

## 6. ML specification

### 6.1 Feature vector — EXACT names and order (`ml/features/engineering.py :: FEATURE_COLUMNS`)

```python
FEATURE_COLUMNS = [
    "cgpa", "tenth_percentage", "twelfth_percentage", "attendance_percentage",
    "coding_score", "aptitude_score", "communication_score",
    "technical_skill_score", "leadership_score",
    "internship_count", "project_count", "certification_count", "hackathon_count",
    "resume_score", "mock_interview_score",
]
TARGET_COLUMN = "placed"  # 0/1
```

Human labels (used in SHAP explanations and frontend): `FEATURE_LABELS: dict[str, str]` e.g. `"cgpa" → "CGPA"`, `"mock_interview_score" → "Mock Interview Score"` — defined once in `engineering.py`, mirrored in frontend `lib/constants.ts`.

Engineered features (added by `add_engineered_features(df)`, appended after base columns): `academic_index` (mean of cgpa*10, tenth, twelfth), `skill_index` (mean of coding, aptitude, technical), `experience_index` (min(internships,3)/3*40 + min(projects,6)/6*30 + min(certs,5)/5*15 + min(hackathons,5)/5*15). `ENGINEERED_COLUMNS = ["academic_index", "skill_index", "experience_index"]`; model trains on `FEATURE_COLUMNS + ENGINEERED_COLUMNS`.

`build_feature_row(profile: dict) -> dict` normalizes a raw profile dict (missing → sensible defaults: counts 0, scores 50.0, cgpa 6.0) and `build_feature_frame(rows: list[dict]) -> pd.DataFrame` produces the model input including engineered columns.

### 6.2 Training (`ml/training/train.py`)

`train_and_register(dataset_path: str, model_dir: str, experiment_name: str = "vaniai-placement") -> dict`:
1. Load CSV → validate (`ml/data/validation.py::validate_dataframe` returns `(ok, errors)`) → clean (`ml/data/cleaning.py::clean_dataframe`: clip ranges, impute medians, drop dupes).
2. Feature engineering; stratified train/test split (80/20, random_state=42); `StandardScaler` inside an sklearn `Pipeline` for each candidate.
3. Candidates: `LogisticRegression(max_iter=1000)`, `RandomForestClassifier(n_estimators=300, random_state=42)`, `XGBClassifier(n_estimators=300, learning_rate=0.1, max_depth=5, eval_metric="logloss", random_state=42)`.
4. Evaluate each (`ml/training/evaluate.py`): accuracy, precision, recall, f1, roc_auc, confusion_matrix. Select best by **roc_auc**.
5. Log every candidate as an MLflow run (params + metrics + model artifact) under `experiment_name` — wrapped in try/except so training succeeds without MLflow.
6. Register best via `ml/training/registry.py::register_model(pipeline, metrics, model_type, model_dir)`:
   - Writes `{model_dir}/versions/{version}/model.joblib` + `metadata.json` `{version, model_type, metrics, feature_columns, trained_at, dataset_path}`
   - Version = `"v{n}"` (next integer). `activate_version(version, model_dir)` copies to `{model_dir}/active/`. Training auto-activates the new best.
   - Also saves the cleaned training frame as `{model_dir}/reference/reference.csv` (drift baseline).
7. Returns `{"version", "model_type", "metrics", "candidates": {name: metrics}, "mlflow_run_id" | None}`.

`ml/data/generate_dataset.py` — **stdlib-only** (random/csv/math, no pandas) synthetic data generator with realistic correlations (higher cgpa/coding/internships ⇒ higher placement odds; target ~55% placed). CLI: `python -m ml.data.generate_dataset --rows 2000 --out data/sample_students.csv`. Columns = FEATURE_COLUMNS + placed + register_number, name, department, batch.

### 6.3 Inference (`ml/inference/`)

- `predictor.py::PlacementPredictor`: `.load(model_dir)` classmethod loads `active/model.joblib` + metadata. If **no artifact exists**, returns a deterministic heuristic fallback (`model_version="heuristic-v0"`, `is_fallback=True`) — weighted sigmoid over normalized features — so the app works before first training. `.predict_proba(features: dict) -> float`, `.model_version: str`. Module-level `get_predictor(model_dir)` cached singleton with `reload_predictor(model_dir)` for post-deploy refresh.
- `explainer.py::explain_prediction(predictor, features: dict) -> dict`: SHAP (TreeExplainer for tree models, LinearExplainer/KernelExplainer fallback; for heuristic fallback compute weight×deviation pseudo-shap). Returns:
  ```json
  {"top_positive": [{"feature", "label", "impact"}], "top_negative": [...], "feature_importance": [{"feature", "label", "importance"}]}
  ```
  top lists max 5 entries, impact = signed float; feature_importance = all features, mean |shap|, sorted desc.
- `readiness.py::compute_readiness(features: dict) -> dict` (all 0–100, rounded 1dp):
  - `academic` = 0.4·(cgpa·10) + 0.2·tenth + 0.2·twelfth + 0.2·attendance
  - `technical` = 0.35·coding + 0.25·technical_skill + 0.2·(min(projects,6)/6·100) + 0.2·(min(certs,5)/5·100)
  - `communication` = 0.5·communication + 0.3·mock_interview + 0.2·leadership
  - `industry` = 0.35·(min(internships,3)/3·100) + 0.2·(min(hackathons,5)/5·100) + 0.3·resume_score + 0.15·aptitude
  - `overall` = 0.3·academic + 0.3·technical + 0.2·communication + 0.2·industry
  Keys: `{"academic", "technical", "communication", "industry", "overall"}`.
- `risk.py::classify_risk(probability: float, features: dict, readiness: dict) -> tuple[str, list[str]]`: `low` ≥ 0.70, `medium` 0.40–0.70, `high` < 0.40. Reasons: human-readable strings for each weak signal (cgpa < 6.5, attendance < 75, coding < 50, communication < 50, aptitude < 50, resume_score < 60, internships == 0, readiness overall < 50…); for low risk return strengths-based reasons.

### 6.4 Recommendations (`ml/recommendation/`)

- `engine.py::generate_recommendations(features, readiness, probability, explanation) -> list[dict]` — rule engine keyed off weak areas + top negative SHAP factors. Each: `{"category": "coding"|"aptitude"|"communication"|"resume"|"academics"|"experience"|"certification"|"interview", "priority": "high"|"medium"|"low", "text": str}`. 4–8 items, dynamic (weakest areas first, priorities scale with deficit). Include concrete actions ("Complete AWS Cloud Practitioner certification", "30 minutes of daily aptitude practice", "Build one full-stack application", "Participate in coding contests", "Mock presentations for communication").
- `career.py::recommend_careers(features) -> list[dict]` — weighted match over roles `Software Engineer, Data Scientist, ML Engineer, Cloud Engineer, Business Analyst, Cyber Security Analyst, Data Engineer`; each `{"role", "match_score" (0–100), "reasons": list[str]}`, sorted desc, top 5. Skill-gap output `identify_skill_gaps(features, readiness) -> list[dict]`: `{"skill", "current", "target", "gap", "severity": "high"|"medium"|"low"}` for communication/coding/aptitude/resume/industry exposure below targets (targets: 70 for scores, 60 resume, industry per readiness).

### 6.5 Resume analyzer (`ml/resume/`)

- `parser.py::extract_text(file_path) -> str` (pypdf), `parse_sections(text) -> dict` (regex/keyword detection of contact, summary, skills, projects, experience, education, certifications, achievements).
- `analyzer.py::analyze_resume(file_path) -> dict`:
  ```json
  {"resume_score": 0-100, "ats_score": 0-100,
   "extracted": {"skills": [str], "projects": [str], "experience": [str], "education": [str]},
   "missing_sections": [str], "suggestions": [str], "word_count": int}
  ```
  Skill taxonomy dict (languages, frameworks, cloud, data, soft skills). Scoring: section coverage 40% + skill breadth 30% + quantified achievements/action verbs 15% + length/format 15%. ATS: text extractability, standard section headers, contact info, no tables/images proxy (chars-per-page heuristics).

### 6.6 Monitoring (`ml/monitoring/`)

- `drift.py::run_drift_report(reference_df, current_df) -> dict` using Evidently 0.4.x `Report(metrics=[DataDriftPreset()])`: returns `{"data_drift_detected": bool, "share_drifted": float, "drifted_features": [str], "n_features": int}`. `run_prediction_drift(ref_probs, cur_probs) -> {"psi": float, "drift_detected": bool}` (PSI > 0.2 ⇒ drift; implement PSI manually).
- `retraining.py::should_retrain(drift_result, prediction_drift, min_new_rows, new_rows) -> tuple[bool, str]` and `trigger_retraining(dataset_path, model_dir) -> dict` (calls train_and_register).

## 7. Backend service/API spec

`prediction_service.py` orchestrates: build features from latest student records → predictor → readiness → risk → SHAP → recommendations → careers → persist `predictions` + `recommendations` rows → return full payload. Custom Prometheus metrics in `app/core/metrics.py`: `vaniai_predictions_total` (Counter), `vaniai_prediction_probability` (Histogram), `vaniai_active_model_info` (Gauge with `version` label), `vaniai_drift_share` (Gauge). Instrumentator exposes `/metrics`.

### Endpoints (all under `/api/v1`; 🔒 = auth required, role in parens)

**auth.py [B2]**
| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/register` | `{email, password, full_name, register_number, department, batch, semester}` → 201 `UserOut` (creates student user + empty student profile) |
| POST | `/auth/login` | `{email, password}` → `{access_token, refresh_token, token_type: "bearer", user: UserOut}` |
| POST | `/auth/refresh` | `{refresh_token}` → same shape as login |
| POST | `/auth/logout` 🔒 | `{refresh_token}` → `{"detail": "Logged out"}` |
| GET | `/auth/me` 🔒 | → `UserOut` |

`UserOut = {id, email, full_name, role, is_active, created_at}`

**students.py [B2]**
| GET | `/students/me` 🔒(student) | → `StudentOut` |
| PUT | `/students/me` 🔒(student) | `StudentUpdate` → `StudentOut` (upserts academic_records/skill_records snapshot when academic/skill values change) |
| GET | `/students` 🔒(faculty, placement_officer, admin) | paginated; filters `department`, `batch`, `risk_level`, `search` → `Page[StudentListItem]` |
| GET | `/students/{student_id}` 🔒(any role; student only self) | → `StudentOut` |
| GET | `/students/{student_id}/progress` 🔒 | → `{academic_history: [{recorded_at, cgpa, attendance_percentage}], skill_history: [{recorded_at, coding_score, aptitude_score, communication_score, technical_skill_score, leadership_score}], prediction_history: [{created_at, placement_probability, readiness_overall}]}` |
| POST | `/students/me/projects` etc. | CRUD sub-resources: `projects`, `internships`, `certifications`, `hackathons` (POST + DELETE `/{item_id}`) |

`StudentOut = {id, user_id, full_name, email, register_number, department, batch, semester, academic: {cgpa, tenth_percentage, twelfth_percentage, attendance_percentage}, skills: {coding_score, aptitude_score, communication_score, technical_skill_score, leadership_score}, experience: {internship_count, project_count, certification_count, hackathon_count, projects: [], internships: [], certifications: [], hackathons: []}, professional: {resume_score, mock_interview_score}, latest_prediction: PredictionOut | null}`
`StudentListItem = {id, full_name, register_number, department, batch, semester, cgpa, placement_probability, readiness_overall, risk_level}` (nullable prediction fields)

**faculty.py [B2]**
| GET | `/faculty/analytics` 🔒(faculty, admin) | query `department?`, `batch?` → `{student_count, average_cgpa, average_readiness, average_probability, at_risk_count, skill_averages: {coding, aptitude, communication, technical, leadership}, top_performers: [StudentListItem×5], weak_students: [StudentListItem×5], risk_distribution: {low, medium, high}}` |
| GET | `/faculty/compare?student_ids=1,2,3` 🔒(faculty, placement_officer, admin) | → `{students: [StudentCompareItem]}` where item = StudentListItem + `skills` + `readiness` objects |
| POST | `/faculty/interview-scores` 🔒(faculty, admin) | `{student_id, mock_interview_score, confidence_level, notes?}` → `{id, student_id, mock_interview_score, confidence_level, interview_readiness: {score, confidence_level, suggestions: [str]}}` (readiness = 0.6·mock + 0.25·communication + 0.15·aptitude) |

**predictions.py [B3]**
| POST | `/predictions/students/{student_id}` 🔒(any; student self only) | → `PredictionOut` (runs full pipeline, persists) |
| GET | `/predictions/students/{student_id}/latest` 🔒 | → `PredictionOut` or 404 |
| GET | `/predictions/students/{student_id}/history` 🔒 | → `[PredictionHistoryItem]` = `{id, created_at, placement_probability, risk_level, readiness_overall, model_version}` |

```
PredictionOut = {id, student_id, model_version, created_at,
  placement_probability: float,
  risk_level, risk_reasons: [str],
  readiness: {academic, technical, communication, industry, overall},
  explanation: {top_positive: [{feature, label, impact}], top_negative: [...], feature_importance: [{feature, label, importance}]},
  skill_gaps: [{skill, current, target, gap, severity}],
  recommendations: [{id, category, priority, text}],
  career_recommendations: [{role, match_score, reasons: [str]}]}
```

**resume.py [B3]**
| POST | `/resume/upload` 🔒(student) | multipart `file` (PDF, ≤5MB) → `ResumeAnalysisOut = {id, filename, resume_score, ats_score, extracted, missing_sections, suggestions, created_at}` |
| GET | `/resume/students/{student_id}/latest` 🔒 | → `ResumeAnalysisOut` or 404 |

**placement.py [B3]**
| GET | `/placement/dashboard` 🔒(placement_officer, admin) | → `{total_students, placement_ready_count (prob ≥ 0.7), average_probability, probability_distribution: [{bucket: "0-10", count}...], department_comparison: [{department, average_probability, average_readiness, student_count, ready_count}], risk_distribution: {low, medium, high}, top_skills: [{skill, average}], common_weak_skills: [{skill, students_below_target}], risk_heatmap: [{department, batch, high_risk_count, student_count}]}` |
| GET | `/placement/at-risk` 🔒(placement_officer, faculty, admin) | paginated `Page[AtRiskStudent]` = StudentListItem + `risk_reasons: [str]` |
| GET | `/placement/export` 🔒(placement_officer, admin) | → CSV file (StreamingResponse) of StudentListItem rows |

**analytics.py [B3]**
| GET | `/analytics/distributions` 🔒(faculty, placement_officer, admin) | → `{probability: [{bucket, count}], readiness: [{bucket, count}], resume_score: [{bucket, count}], risk: {low, medium, high}}` (buckets "0-10"…"90-100") |
| GET | `/analytics/departments` 🔒(same) | → `[{department, student_count, average_cgpa, average_probability, average_readiness, ready_count, at_risk_count}]` |
| GET | `/analytics/skills` 🔒(same) | query `department?` → `{skill_averages: {...}, skill_distribution: [{skill, buckets: [{bucket, count}]}]}` |

**reports.py [B3]** (reportlab PDFs, stored under `UPLOAD_DIR/reports/`)
| GET | `/reports/students/{student_id}` 🔒 | → PDF FileResponse (profile, scores, readiness, prediction, recommendations table) |
| GET | `/reports/department/{department}` 🔒(faculty, placement_officer, admin) | → PDF (aggregates) |
| GET | `/reports/placement` 🔒(placement_officer, admin) | → PDF (dashboard aggregates) |

**admin.py [B4]**
| GET/POST | `/admin/users` 🔒(admin) | list paginated (filter `role`, `search`) / create `{email, password, full_name, role}` → `UserOut` |
| PUT/DELETE | `/admin/users/{user_id}` 🔒(admin) | update `{full_name?, role?, is_active?, password?}` / soft-delete (is_active=false) |
| POST | `/admin/datasets/upload` 🔒(admin) | multipart CSV → validates via ml.data.validation → `DatasetOut = {id, name, filename, row_count, status, validation_errors, created_at}` |
| GET | `/admin/datasets` 🔒(admin) | → `Page[DatasetOut]` |
| POST | `/admin/training/start` 🔒(admin) | `{dataset_id}` → 202 `{experiment_id, status: "running"}` (FastAPI BackgroundTasks → training_service.run_training) |
| GET | `/admin/training/history` 🔒(admin) | → `Page[ExperimentOut]` = `{id, mlflow_run_id, dataset_id, model_type, params, metrics, status, started_at, finished_at}` |
| GET | `/admin/models` 🔒(admin) | → `[ModelVersionOut]` = `{id, version, model_type, metrics, is_active, created_at}` |
| POST | `/admin/models/{version}/deploy` 🔒(admin) | activates version, reloads predictor → `ModelVersionOut` |
| POST | `/admin/retraining/trigger` 🔒(admin) | → 202 `{experiment_id, status: "running"}` (retrains on latest used dataset) |

**monitoring.py [B4]**
| GET | `/monitoring/health` 🔒(admin) | → `{status: "ok", database: bool, model_loaded: bool, model_version, is_fallback: bool, mlflow_configured: bool, uptime_seconds}` |
| GET | `/monitoring/drift` 🔒(admin) | → `{data_drift: {data_drift_detected, share_drifted, drifted_features, checked_at} | null, prediction_drift: {psi, drift_detected, checked_at} | null, history: [{id, metric_type, drift_detected, created_at}]}` |
| POST | `/monitoring/drift/run` 🔒(admin) | runs drift check now (reference.csv vs recent prediction inputs), persists monitoring_log → same shape as GET |

## 8. Frontend contracts

### 8.1 Build config [F1]

- Vite 6 + `@vitejs/plugin-react`; dev server proxy: `"/api" → "http://localhost:8000"`. Path alias `@/` → `src/`.
- Tailwind 3.4 (`darkMode: "class"`), tailwindcss-animate, shadcn-style CSS variables in `index.css` (`--background`, `--foreground`, `--primary` (violet 262 83% 58%), `--card`, etc., both `:root` and `.dark`).
- Brand gradient utility class: `bg-gradient-to-r from-violet-600 to-blue-600` (headings/buttons/accents); glassmorphism card: `bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-lg`.
- `package.json` deps (exact set F1 must install): react@^19, react-dom@^19, react-router-dom@^7, @tanstack/react-query@^5, axios, recharts@^2.15, framer-motion@^12, react-hook-form@^7, zod@^3, @hookform/resolvers, lucide-react, clsx, tailwind-merge, class-variance-authority, sonner, date-fns, @radix-ui/react-{dialog,dropdown-menu,select,tabs,label,avatar,progress,separator,switch,tooltip,slot}. Dev: typescript@~5.7, vite@^6, @vitejs/plugin-react, tailwindcss@^3.4, postcss, autoprefixer, tailwindcss-animate, @types/react, @types/react-dom, @types/node.
- Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck` (`tsc --noEmit`).

### 8.2 Types (`src/types/index.ts`) [F1]

TypeScript interfaces mirroring §7 response shapes 1:1 in snake_case: `User`, `Role`, `AuthResponse`, `Student`, `StudentListItem`, `StudentProgress`, `Prediction`, `PredictionHistoryItem`, `Readiness`, `Explanation`, `ExplanationFactor`, `SkillGap`, `Recommendation`, `CareerRecommendation`, `ResumeAnalysis`, `FacultyAnalytics`, `PlacementDashboard`, `Distributions`, `DepartmentAnalytics`, `SkillAnalytics`, `Dataset`, `Experiment`, `ModelVersion`, `MonitoringHealth`, `DriftStatus`, `Page<T>`, `RiskLevel`, `Department`, `InterviewScoreResult`.

### 8.3 API layer [F1]

- `lib/api-client.ts`: axios instance `apiClient`, baseURL `/api/v1`; request interceptor adds `Authorization: Bearer <access_token>` from localStorage (`vaniai_access_token`, `vaniai_refresh_token`); 401 response interceptor → single-flight refresh → retry once → on failure clear tokens + redirect `/login`.
- `lib/api.ts` exports typed modules — **feature pages must use these, never raw axios**: `authApi` (login, register, logout, me), `studentApi` (getMe, updateMe, list, get, progress, addProject/addInternship/addCertification/addHackathon, deleteProject/…), `predictionApi` (predict, latest, history), `resumeApi` (upload, latest), `facultyApi` (analytics, compare, submitInterviewScore), `placementApi` (dashboard, atRisk, exportCsv), `analyticsApi` (distributions, departments, skills), `reportApi` (studentReportUrl/download helpers), `adminApi` (users CRUD, datasets, uploadDataset, startTraining, trainingHistory, models, deployModel, triggerRetraining, monitoringHealth, drift, runDrift).
- TanStack Query for all reads; mutations invalidate related queries; toasts via sonner.

### 8.4 Auth & routing [F1]

- `hooks/use-auth.tsx`: `AuthProvider` + `useAuth() → {user, isLoading, login(email, password), register(data), logout()}`; bootstraps from `/auth/me` when token exists.
- `App.tsx` routes: `/login`, `/register`; `RequireAuth`/`RequireRole` guards; role home redirect map: student→`/student`, faculty→`/faculty`, placement_officer→`/placement`, admin→`/admin`.
- Route table: `/student`(Dashboard) `/student/profile` `/student/resume` `/student/progress` `/student/reports`; `/faculty`(Dashboard) `/faculty/students` `/faculty/students/:id` `/faculty/compare` `/faculty/interviews`; `/placement`(Dashboard) `/placement/at-risk` `/placement/departments`; `/admin`(Dashboard) `/admin/users` `/admin/datasets` `/admin/models` `/admin/monitoring`.
- `DashboardLayout` (components/layout): collapsible sidebar (role-filtered nav items w/ lucide icons), topbar (page title, theme toggle, user dropdown w/ logout), `<Outlet/>` content area, Framer Motion page transitions (fade+slide, 0.2s), gradient logo "VaniAI".

### 8.5 Shared components [F1]

- `StatCard {title, value, icon: LucideIcon, description?, trend?: {value: number, positive: boolean}, gradient?: boolean}` — glass card, big proportional-figure value, optional delta.
- `ScoreRing {value (0-100), size?, label?}` — SVG circular progress, color by band (≥70 good, 40–70 warning, <40 critical).
- `RiskBadge {level: RiskLevel}` — icon + label + status color (never color alone).
- `GlassCard`, `PageHeader {title, description?, actions?}`, `EmptyState {icon, title, description?, action?}`, `LoadingState`, `ErrorState {onRetry?}`, `DataTable<T> {columns: {key, header, render?}[], data, onRowClick?}`.
- `components/ui/*`: shadcn-style button, card, input, label, badge, select, tabs, table, dialog, dropdown-menu, avatar, progress, separator, skeleton, switch, textarea, tooltip, sonner wrapper.

### 8.6 Charts (`src/components/charts/`) [F1] — Recharts wrappers, theme-aware

`lib/chart-colors.ts` exports `useChartColors()` (reads theme) returning validated palette:

```ts
// categorical (fixed order, never cycled; fold >8 into "Other")
light: ['#2a78d6','#1baf7a','#eda100','#008300','#4a3aa7','#e34948','#e87ba4','#eb6834']
dark:  ['#3987e5','#199e70','#c98500','#008300','#9085e9','#e66767','#d55181','#d95926']
// sequential (blue ramp for heatmaps/magnitude)
seq: ['#cde2fb','#9ec5f4','#6da7ec','#3987e5','#256abf','#184f95','#0d366b']
// status — risk mapping: low→good, medium→warning, high→critical (ALWAYS icon+label too)
status: { good:'#0ca30c', warning:'#fab219', serious:'#ec835a', critical:'#d03b3b' }
// chrome
grid: light '#e1e0d9' / dark '#2c2c2a'; axisText '#898781'; light surface '#fcfcfb'; dark '#1a1a19'
```

Mark rules baked into every wrapper: bars `maxBarSize={24}` `radius={[4,4,0,0]}` (horizontal: `[0,4,4,0]`); lines `strokeWidth={2}` with dots ≥ r4 + 2px surface-colored ring; area fills at 10% opacity; `CartesianGrid` hairline solid using grid token, no vertical lines; axis/tick text uses muted token, never series colors; tooltips on every chart (shared `<ChartTooltip/>` styled card); legend rendered when ≥2 series, omitted for single series; **never dual axes**.

Components (all `{height?: number}` default 280):
- `TrendLineChart {data: Record<string, string|number>[], xKey: string, series: {key, name}[]}`
- `ProgressAreaChart` (same props, area 10% fill)
- `DistributionBarChart {data: {bucket: string, count: number}[], color?: 'seq'|'cat'}`
- `DepartmentComparisonChart {data: DepartmentAnalytics[], metrics: {key, name}[]}` (grouped bars)
- `SkillRadarChart {data: {skill: string, value: number, benchmark?: number}[]}`
- `FeatureImportanceChart {data: ExplanationFactor[], signed?: boolean}` (horizontal bars; signed mode: positive blue #2a78d6/#3987e5, negative red #e34948/#e66767)
- `RiskDonutChart {data: {low, medium, high}}` (status colors, center total, legend w/ counts)
- `RiskHeatmap {data: {department, batch, high_risk_count, student_count}[]}` (CSS grid, sequential ramp by high-risk share, cell tooltips, in-cell labels auto white/ink by luminance)

### 8.7 Pages (feature agents — read F1's actual files before coding)

- **F2 student**: Dashboard (StatCards: placement probability w/ ScoreRing, readiness overall, resume score, interview score; TrendLineChart probability+readiness history; SkillRadarChart; FeatureImportanceChart signed from latest prediction explanation; skill-gap list; recommendations timeline w/ priority badges + framer stagger; career matches; "Run Prediction" button → predictionApi.predict). Profile (react-hook-form+zod sections: personal/academic/skills + CRUD lists for projects/internships/certifications/hackathons). Resume (drag-drop PDF upload, ScoreRing resume+ATS, extracted chips, missing sections, suggestions). Progress (ProgressAreaChart academic, TrendLineChart skills+probability histories). Reports (download student PDF via reportApi).
- **F3 faculty**: Dashboard (dept/batch filters; StatCards; skill averages radar; RiskDonutChart; top performers/weak students tables). Students (paginated DataTable, filters, row → detail). StudentDetail (embed prediction view + progress + "Run Prediction"). Compare (multi-select 2–4 students, SkillRadarChart overlay ≤4 series + comparison table). Interviews (form → facultyApi.submitInterviewScore, shows interview_readiness result). **placement**: Dashboard (StatCards; DistributionBarChart probability; DepartmentComparisonChart; RiskDonutChart; top skills / common weak skills lists; RiskHeatmap). AtRisk (table w/ risk_reasons, CSV export button). Departments (DepartmentComparisonChart + DataTable + per-dept report download).
- **F4 admin**: Dashboard (system health cards from monitoringHealth: model version + fallback warning, db status; active model metrics; training history list; drift status). Users (DataTable + create/edit dialogs, role select, activate/deactivate). Datasets (upload CSV w/ validation results, status badges). Models (training history table w/ metrics; model versions table; deploy buttons; "Start Training" on dataset; "Trigger Retraining"). Monitoring (drift cards: share_drifted meter, drifted features chips, PSI; run-drift-now button; history table; link to Grafana http://localhost:3001).

Polling: training/drift pages use TanStack Query `refetchInterval: 5000` while an experiment status is `running`.

## 9. MLOps / infra [O1 unless noted]

- **docker-compose.yml**: services per §3 table; postgres init script creates `mlflow` db; backend depends_on postgres healthcheck, runs `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000`; named volumes for pgdata, ml_artifacts, mlflow artifacts; backend env `MLFLOW_TRACKING_URI=http://mlflow:5000`.
- **backend/Dockerfile**: python:3.12-slim, non-root user, installs requirements, copies app+ml+alembic+scripts.
- **frontend/Dockerfile**: node:22-alpine build (`npm ci && npm run build`) → nginx:alpine serve; `nginx.conf` SPA fallback + `location /api { proxy_pass http://backend:8000; }`.
- **CI `.github/workflows/ci.yml`**: on push/PR → jobs: `backend` (setup-python 3.12, pip install -r requirements.txt, ruff check, pytest with sqlite test DB), `frontend` (setup-node 22, npm ci, npm run typecheck, npm run build), `docker` (build both images, no push).
- **CD `cd.yml`**: on tag `v*` → build & push images to GHCR, then (placeholder) deploy step with docker compose pull/up documentation.
- **retrain.yml**: weekly cron + workflow_dispatch → runs `python -m ml.monitoring.retraining` style retrain script inside backend image (documented placeholder for real infra).
- **dvc.yaml [M1]**: stages `generate_data` → `train` (cmd `python -m ml.training.train --dataset ../data/sample_students.csv`, deps on ml code + data, outs ml_artifacts); `params.yaml` holds model hyperparams (train.py reads it when present).
- **Prometheus** scrape job `vaniai-backend` → `backend:8000/metrics`, 15s interval.
- **Grafana** provisioning: prometheus datasource + `vaniai-overview.json` dashboard (request rate/latency from instrumentator histograms, predictions_total, prediction probability histogram, drift_share gauge, model version stat).
- **Makefile** targets: `install`, `dev-backend`, `dev-frontend`, `seed`, `train`, `test`, `lint`, `up`, `down`, `logs`.

## 10. Seed & demo data (`backend/scripts/seed.py` [B4])

Idempotent (skip if users exist). Creates:
- Demo accounts (password rules: ≥8 chars): `admin@vaniai.io/Admin@123` (admin), `faculty@vaniai.io/Faculty@123` (faculty), `placement@vaniai.io/Placement@123` (placement_officer), `student@vaniai.io/Student@123` (student with full rich profile).
- 150 synthetic students (Faker names, register numbers `21CSE001` style, all 6 departments, batches 2024–2027) with academic/skill records (2–4 historical snapshots each for progress charts), projects/internships/certifications/hackathons, plausible resume_score/mock_interview_score.
- Generates dataset CSV via `ml.data.generate_dataset` (2000 rows) → registers as dataset row → runs `train_and_register` → predictions for every student via prediction_service.
Console-prints demo credentials table at the end.

## 11. Quality bar (all agents)

- No TODOs, stubs, `pass` bodies, or placeholder comments — every file complete and runnable.
- Type hints throughout Python; strict-mode-clean TypeScript (no `any` unless unavoidable).
- Services raise domain exceptions from `app/core/exceptions.py` (`NotFoundError`, `PermissionDeniedError`, `ValidationError`, `ConflictError`) — global handlers in `main.py` map them to 404/403/422/409.
- Every list endpoint paginated; every FK indexed; every upload size/type-validated.
- Frontend: loading skeletons + error states + empty states on every data view; all forms validated with zod; dark mode correct everywhere (use tokens, never hardcoded grays).
