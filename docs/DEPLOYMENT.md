# Deployment Guide

This guide covers running VaniAI in production with Docker Compose, consuming prebuilt images from GitHub Container Registry (GHCR), putting the stack behind TLS, and scaling it.

---

## 1. Topology

The production stack is the same six services as development, hardened:

| Service | Image | Internal port | Exposed |
|---|---|---|---|
| `postgres` | `postgres:16` | 5432 | **no** (internal network only in production) |
| `backend` | `ghcr.io/<owner>/vaniai-backend:<tag>` | 8000 | via frontend proxy only |
| `frontend` | `ghcr.io/<owner>/vaniai-frontend:<tag>` | 80 | behind the reverse proxy |
| `mlflow` | MLflow server | 5000 | internal / VPN only |
| `prometheus` | `prom/prometheus` | 9090 | internal / VPN only |
| `grafana` | `grafana/grafana` | 3000 (host 3001) | behind auth, internal / VPN preferred |

Only the reverse proxy (and optionally Grafana) should be reachable from the internet. Everything else stays on the compose network — nginx inside the `frontend` image already proxies `/api` → `backend:8000`, so the public surface is a single origin.

---

## 2. Secrets and configuration

Never ship the development defaults. At minimum, change these before going live:

1. **`SECRET_KEY`** — signs all JWTs. Generate a strong value:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

2. **PostgreSQL credentials** — replace the dev `vaniai/vaniai` pair with strong credentials and update `DATABASE_URL` accordingly.
3. **Grafana admin password** (`GF_SECURITY_ADMIN_PASSWORD`).
4. **`CORS_ORIGINS`** — set to your real public origin(s) only, e.g. `https://vaniai.example.com`.
5. **`AUTO_CREATE_TABLES=false`** — production schema management is Alembic-only. The backend container already runs `alembic upgrade head` before starting uvicorn, so migrations apply automatically on deploy.
6. **`ENVIRONMENT=production`**.

Keep production values in an untracked `.env` file next to `docker-compose.yml` (or a compose override file), or use Docker secrets / your orchestrator's secret store. Never commit real secrets; `backend/.env.example` documents the schema.

### Environment matrix

| Variable | Development (local) | Docker (dev/demo) | Production |
|---|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://vaniai:vaniai@localhost:5432/vaniai` | `postgresql+psycopg2://vaniai:vaniai@postgres:5432/vaniai` | managed/hardened Postgres, strong password, TLS if off-host |
| `SECRET_KEY` | `change-me-in-production` | `change-me-in-production` | 64+ random bytes, rotated on compromise |
| `ALGORITHM` | `HS256` | `HS256` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | `30` | `15`–`30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | `7` | `7` (tokens are hashed + rotated server-side) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | `http://localhost:3000` | `https://vaniai.example.com` |
| `MODEL_DIR` | `./ml_artifacts` | `/app/ml_artifacts` (named volume) | named volume or mounted persistent disk |
| `UPLOAD_DIR` | `./uploads` | `/app/uploads` (named volume) | named volume or mounted persistent disk |
| `MLFLOW_TRACKING_URI` | *(empty — local `./mlruns`)* | `http://mlflow:5000` | `http://mlflow:5000` or dedicated MLflow host |
| `ENVIRONMENT` | `development` | `development` | `production` |
| `AUTO_CREATE_TABLES` | `true` | `true` | `false` |

---

## 3. Persistent data: volumes and backups

Three kinds of state must survive container recreation:

| Data | Location | Volume |
|---|---|---|
| Database | `postgres` data dir | `pgdata` named volume |
| Model registry (`versions/`, `active/`, `reference/reference.csv`) | backend `MODEL_DIR` | `ml_artifacts` named volume |
| MLflow artifacts | mlflow artifact root | mlflow artifacts named volume |
| Uploads (resumes, datasets, generated PDF reports) | backend `UPLOAD_DIR` | named volume or bind mount |

### Backups

**Database** — nightly logical dump (schedule via Task Scheduler / cron):

```powershell
docker compose exec -T postgres pg_dump -U vaniai vaniai | Set-Content -Encoding utf8 "backups/vaniai-$(Get-Date -Format yyyyMMdd).sql"
```

Restore:

```powershell
Get-Content backups/vaniai-20260707.sql | docker compose exec -T postgres psql -U vaniai vaniai
```

**Model artifacts** — archive the volume periodically (model versions are append-only, so incremental copies are cheap):

```powershell
docker run --rm -v vaniai_ml_artifacts:/data -v ${PWD}/backups:/backup alpine tar czf /backup/ml_artifacts.tgz -C /data .
```

Test restores regularly. A restored database plus a restored `ml_artifacts` volume brings the platform back completely; MLflow history is nice-to-have but not required for serving.

---

## 4. Images from GHCR (CD pipeline)

`.github/workflows/cd.yml` builds and pushes both images to GHCR whenever a `v*` tag is pushed:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

This publishes:

- `ghcr.io/<owner>/vaniai-backend:v1.0.0`
- `ghcr.io/<owner>/vaniai-frontend:v1.0.0`

On the server, point compose at the tagged images (compose override or env-substituted tags), then:

```powershell
docker login ghcr.io   # PAT with read:packages, or a deploy token
docker compose pull
docker compose up -d
```

The backend entrypoint runs `alembic upgrade head` before uvicorn, so schema migrations roll out with the image. Roll back by re-deploying the previous tag (Alembic migrations are forward-applied; write reversible migrations if you need `alembic downgrade`).

The related CI workflow (`ci.yml`) gates every push/PR with ruff + pytest (backend), typecheck + build (frontend), and a no-push Docker build of both images. `retrain.yml` runs the scheduled retraining job (see [MLOPS.md](MLOPS.md)).

---

## 5. Reverse proxy and TLS

Terminate TLS in front of the `frontend` service. The SPA and the API share one origin (nginx inside the frontend image proxies `/api`), so a single vhost suffices.

**Caddy** (automatic Let's Encrypt):

```caddyfile
vaniai.example.com {
    reverse_proxy frontend:80
}
```

**nginx** (host-level):

```nginx
server {
    listen 443 ssl http2;
    server_name vaniai.example.com;
    ssl_certificate     /etc/letsencrypt/live/vaniai.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vaniai.example.com/privkey.pem;

    client_max_body_size 10m;   # resume PDFs (≤5MB) + dataset CSV uploads

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Notes:

- Allow request bodies of at least 10 MB end-to-end (resume uploads are capped at 5 MB, dataset CSVs can be larger).
- Redirect port 80 → 443.
- Do **not** expose `postgres`, `mlflow`, or `prometheus` publicly. If Grafana must be reachable, put it behind its own auth (it has one) and preferably an allowlist/VPN.
- Update `CORS_ORIGINS` to the public HTTPS origin.

---

## 6. Scaling

### Backend workers

Uvicorn runs single-process by default. Scale vertically first:

```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Rule of thumb: `workers ≈ CPU cores` (prediction requests are CPU-bound: model inference + SHAP). Each worker loads its own copy of the active model via the cached predictor singleton; after a model deploy the API reloads the predictor, and workers pick up the new `active/` artifact.

Horizontal scaling (multiple backend replicas behind the nginx proxy) works because the app is stateless — JWTs carry auth, and all state lives in PostgreSQL and the shared `ml_artifacts` volume. Give replicas a shared volume (or object storage sync) for `MODEL_DIR` and `UPLOAD_DIR`.

### Long-running work

Training and retraining run in FastAPI `BackgroundTasks` inside the backend process. Under heavy usage, move training to a dedicated worker host: run a second backend container that only executes training (or invoke `python -m ml.training.train` on a schedule) against the same database and `ml_artifacts` volume, keeping the request-serving replicas latency-stable.

### Separate MLflow

For team-scale experiment tracking, run MLflow on its own host with the `mlflow` PostgreSQL database as the backend store and object storage (e.g. S3-compatible) for artifacts, then point `MLFLOW_TRACKING_URI` at it. VaniAI's training code tolerates MLflow outages by design (logging is wrapped in try/except and falls back silently), so MLflow is never on the serving critical path.

### Database

- Set a sensible SQLAlchemy pool size per worker (workers × pool_size must stay below Postgres `max_connections`).
- All FKs are indexed per the schema contract; the heaviest queries are the analytics aggregates — monitor them in Grafana request-latency panels and add covering indexes if a real workload demands it.

### Monitoring stack

Prometheus retention defaults are fine for a single node; set `--storage.tsdb.retention.time=30d` explicitly if you care. Grafana dashboards are provisioned from `mlops/grafana/provisioning/`, so a Grafana container is disposable.

---

## 7. Production checklist

- [ ] `SECRET_KEY` replaced with a strong random value
- [ ] PostgreSQL password changed; port 5432 not published to the host
- [ ] `AUTO_CREATE_TABLES=false`, `ENVIRONMENT=production`
- [ ] `CORS_ORIGINS` set to the public origin only
- [ ] TLS terminated at the reverse proxy; HTTP redirects to HTTPS
- [ ] Named volumes for `pgdata`, `ml_artifacts`, MLflow artifacts, uploads
- [ ] Nightly `pg_dump` + periodic `ml_artifacts` archive, restore tested
- [ ] Grafana admin password changed; MLflow/Prometheus not publicly exposed
- [ ] Images deployed by tag from GHCR (no `latest` in production)
- [ ] Seed script **not** run in production (it creates demo accounts) — create the initial admin via a controlled one-off instead
- [ ] Uptime + drift alerting wired to Prometheus/Grafana (see [MLOPS.md](MLOPS.md))

---

See also: [Installation](INSTALLATION.md) · [Architecture](ARCHITECTURE.md) · [MLOps](MLOPS.md)
