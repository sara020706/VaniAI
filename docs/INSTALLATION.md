# Installation Guide

This guide covers two installation paths:

- **Path A — Docker Compose**: everything (PostgreSQL, backend, frontend, MLflow, Prometheus, Grafana) in containers. Recommended for evaluation and demos.
- **Path B — Manual local development**: backend and frontend run natively for fast iteration; PostgreSQL runs locally (or in Docker).

All shell examples use **PowerShell** (Windows). Equivalent bash commands work on macOS/Linux with the usual path adjustments.

---

## 1. Prerequisites

| Requirement | Version | Needed for | Check |
|---|---|---|---|
| Python | **3.12** | Backend + ML (Path B) | `py -3.12 --version` |
| Node.js | **22+** (includes npm) | Frontend (Path B) | `node --version` |
| Docker Desktop | latest, with Compose v2 | Path A (and optional Postgres for Path B) | `docker compose version` |
| PostgreSQL | **16** | Path B only, if not using Docker for the DB | `psql --version` |
| Git | any recent | cloning | `git --version` |

> **Windows note:** if PowerShell refuses to run the virtualenv activation script, allow local scripts once per user:
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

## 2. Path A — Docker Compose

### 2.1 Clone and start

```powershell
git clone https://github.com/your-org/VaniAI.git
cd VaniAI
docker compose up -d --build
```

The compose stack starts six services:

| Service | Compose name | Host port | Notes |
|---|---|---|---|
| PostgreSQL 16 | `postgres` | 5432 | db `vaniai`, user `vaniai`, password `vaniai`; a second `mlflow` database is created by an init script |
| FastAPI backend | `backend` | 8000 | runs `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| React frontend | `frontend` | 3000 | nginx serves the SPA and proxies `/api` → `backend:8000` |
| MLflow | `mlflow` | 5000 | backend uses `MLFLOW_TRACKING_URI=http://mlflow:5000` |
| Prometheus | `prometheus` | 9090 | scrapes `backend:8000/metrics` every 15s |
| Grafana | `grafana` | 3001 | pre-provisioned Prometheus datasource + VaniAI overview dashboard |

Wait for the backend to become healthy, then verify:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

### 2.2 Seed demo data

The seed script is idempotent (it skips if users already exist). It creates the four demo accounts, 150 synthetic students with historical records, generates a 2,000-row training dataset, trains and registers the first model, and runs predictions for every student:

```powershell
docker compose exec backend python -m scripts.seed
```

Seeding includes a full model-training run, so expect it to take a couple of minutes. The demo credentials table is printed to the console at the end (also listed in [section 5](#5-demo-credentials)).

### 2.3 Open the app

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- MLflow: http://localhost:5000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

To stop everything: `docker compose down` (add `-v` to also delete database and model volumes).

---

## 3. Path B — Manual local development

### 3.1 PostgreSQL 16

**Option 1 — local install.** Create the role and databases (run from an account that can reach the `postgres` superuser):

```powershell
psql -U postgres -c "CREATE USER vaniai WITH PASSWORD 'vaniai';"
psql -U postgres -c "CREATE DATABASE vaniai OWNER vaniai;"
psql -U postgres -c "CREATE DATABASE mlflow OWNER vaniai;"   # optional, only for a local MLflow server
```

**Option 2 — just the database in Docker:**

```powershell
docker compose up -d postgres
```

Either way, PostgreSQL must be reachable at `localhost:5432` with db `vaniai` / user `vaniai` / password `vaniai` (or adjust `DATABASE_URL` in step 3.3).

### 3.2 Backend — virtual environment and dependencies

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

> `requirements.txt` pins `bcrypt==4.0.1` on purpose — newer bcrypt releases break passlib. Do not upgrade it manually (see [Troubleshooting](#6-troubleshooting)).

### 3.3 Backend — configuration (`.env`)

```powershell
Copy-Item .env.example .env
```

The defaults work out of the box for local development. Every variable, explained:

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://vaniai:vaniai@localhost:5432/vaniai` | SQLAlchemy connection string. Change host/credentials if your Postgres differs. |
| `SECRET_KEY` | `change-me-in-production` | Signs JWTs. Fine for dev; **must** be a long random value in production. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access-token lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh-token lifetime (tokens are stored hashed and rotated on every refresh). |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated origins allowed by the browser. Covers the Vite dev server (5173) and the nginx frontend (3000). |
| `MODEL_DIR` | `./ml_artifacts` | Where trained model versions, the active model, and the drift reference CSV live. |
| `UPLOAD_DIR` | `./uploads` | Where resume PDFs, dataset CSVs, and generated reports are stored. |
| `MLFLOW_TRACKING_URI` | *(empty)* | Empty ⇒ ML code logs to a local `./mlruns` directory and never fails if MLflow is down. Set to `http://localhost:5000` to use a local MLflow server. |
| `ENVIRONMENT` | `development` | Environment name used for logging/behavior toggles. |
| `AUTO_CREATE_TABLES` | `true` | Dev convenience: creates tables on startup via `Base.metadata.create_all`. Production uses Alembic migrations only — set to `false` there. |

### 3.4 Backend — migrate, seed, run

```powershell
alembic upgrade head        # apply database migrations
python -m scripts.seed      # demo users + 150 students + dataset + first model + predictions
uvicorn app.main:app --reload --port 8000
```

Verify: http://localhost:8000/health and http://localhost:8000/docs

### 3.5 Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to `http://localhost:8000`, so no CORS configuration is needed for normal development.

Useful frontend scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | dev server with HMR (port 5173) |
| `npm run build` | type-check (`tsc -b`) + production build |
| `npm run preview` | serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |

### 3.6 Optional — local MLflow server

The backend and training code work without MLflow (runs are logged to `./mlruns`). To get the MLflow UI locally:

```powershell
# from the activated backend venv
mlflow server --host 127.0.0.1 --port 5000 --backend-store-uri sqlite:///mlflow.db
```

Then set `MLFLOW_TRACKING_URI=http://localhost:5000` in `backend/.env` and restart the backend.

### 3.7 Optional — Makefile shortcuts

If you have `make` available (Git Bash / WSL / `choco install make`):

| Target | Equivalent |
|---|---|
| `make install` | install backend + frontend dependencies |
| `make dev-backend` | run uvicorn with reload |
| `make dev-frontend` | run Vite dev server |
| `make seed` | run the seed script |
| `make train` | run a training job |
| `make test` | run pytest |
| `make lint` | run ruff |
| `make up` / `make down` / `make logs` | docker compose lifecycle |

---

## 4. Verifying the installation

1. `GET http://localhost:8000/health` returns a healthy status.
2. Log in at the frontend with `student@vaniai.io` / `Student@123` — the student dashboard should show a placement probability, readiness ring, and recommendations.
3. Log in as `admin@vaniai.io` / `Admin@123` → **Models** page shows model version `v1` as active (if the model shows as `heuristic-v0` fallback, training has not run yet — see the seed step).
4. `GET http://localhost:8000/metrics` returns Prometheus metrics including `vaniai_predictions_total`.

---

## 5. Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@vaniai.io` | `Admin@123` |
| Faculty | `faculty@vaniai.io` | `Faculty@123` |
| Placement Officer | `placement@vaniai.io` | `Placement@123` |
| Student | `student@vaniai.io` | `Student@123` |

---

## 6. Troubleshooting

### Port already in use

Symptom: `bind: address already in use` / `Only one usage of each socket address` on 3000, 5000, 5432, 8000, 9090, or 3001.

Find the offender and stop it, or remap the host port:

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object -Property OwningProcess
Get-Process -Id <pid>
```

Common conflicts: a local PostgreSQL service on 5432 while also running the `postgres` container, Grafana's default 3000 (VaniAI maps Grafana to **3001** for this reason), and macOS AirPlay on 5000. For Compose, edit the *host* side of the port mapping (e.g. `"8001:8000"`) — container ports must stay as-is.

### bcrypt / passlib error on login or seeding

Symptom: `AttributeError: module 'bcrypt' has no attribute '__about__'` or `ValueError: password cannot be longer than 72 bytes` traces mentioning passlib.

Cause: passlib 1.7.x is incompatible with bcrypt ≥ 4.1. VaniAI pins `bcrypt==4.0.1` in `backend/requirements.txt`. If your environment drifted:

```powershell
pip install bcrypt==4.0.1
```

### XGBoost fails to import on Linux (`libgomp.so.1`)

Symptom (inside a slim Docker image or minimal Linux): `OSError: libgomp.so.1: cannot open shared object file`.

Cause: XGBoost needs the GNU OpenMP runtime, which `python:3.12-slim` does not ship. The provided `backend/Dockerfile` installs it; if you build your own image add:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
```

(Not applicable on Windows/macOS native installs.)

### CORS errors in the browser console

Symptom: `blocked by CORS policy: No 'Access-Control-Allow-Origin' header`.

- The browser origin must be listed in `CORS_ORIGINS` in `backend/.env` (comma-separated, no spaces, no trailing slash). Defaults cover `http://localhost:5173` and `http://localhost:3000`.
- Restart the backend after changing `.env`.
- If you use the Vite dev server or the nginx frontend as intended, API calls go through the `/api` proxy and are **same-origin** — CORS errors then usually mean you are calling `http://localhost:8000` directly from frontend code instead of the relative `/api/v1` base path.

### `/api` requests return 404 / 502 (proxy issues)

- **Vite dev (5173):** the proxy forwards `/api` → `http://localhost:8000`. A 500/ECONNREFUSED in the Vite terminal means the backend is not running on 8000.
- **Docker frontend (3000):** nginx proxies `/api` → `http://backend:8000` on the compose network. Check `docker compose logs backend` — the backend may have exited (commonly a database connection failure on startup).
- A 404 with FastAPI's `{"detail": "Not Found"}` envelope means the proxy works but the path is wrong — all endpoints live under `/api/v1/...`.

### Database connection failures

Symptom: `connection refused` or `password authentication failed` during `alembic upgrade head` or backend startup.

- Confirm Postgres is running and reachable: `psql -h localhost -U vaniai -d vaniai`.
- Confirm `DATABASE_URL` matches your actual host/port/credentials.
- In Docker, the backend must use host `postgres` (the compose service name), not `localhost` — compose sets this for you; don't override it with a local `.env` copied into the image.

### Seed script appears to hang

The seed run trains three candidate models (LogisticRegression, RandomForest, XGBoost) on 2,000 rows and then generates predictions for 150 students — a few minutes on a laptop is normal. Watch progress with `docker compose logs -f backend` (Docker) or the console output (local).

### Frontend shows "heuristic model" warning on the admin dashboard

The predictor falls back to a deterministic heuristic (`heuristic-v0`) when no trained artifact exists in `MODEL_DIR/active/`. Run the seed script, or upload a dataset and start training from **Admin → Datasets / Models**. The app is fully functional in fallback mode — predictions are just rule-based rather than learned.

---

Next steps: [User Guide](USER_GUIDE.md) · [API Reference](API.md) · [Deployment](DEPLOYMENT.md)
