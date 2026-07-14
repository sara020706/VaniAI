# syntax=docker/dockerfile:1
# VaniAI backend — FastAPI + scikit-learn/XGBoost/SHAP inference service.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependencies:
#   libgomp1 — OpenMP runtime required by XGBoost wheels
#   libpq5   — PostgreSQL client library for psycopg2
#   curl     — container healthcheck against /health
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first so this (slow) layer is cached until
# requirements.txt actually changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application source
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
COPY ml ./ml
COPY scripts ./scripts

# Run as a dedicated non-root user; pre-create the writable runtime
# directories (mounted as named volumes in docker-compose).
RUN groupadd --system vaniai \
    && useradd --system --gid vaniai --create-home vaniai \
    && mkdir -p /app/ml_artifacts /app/uploads /app/mlruns \
    && chown -R vaniai:vaniai /app
USER vaniai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# docker-compose overrides this with "alembic upgrade head && uvicorn ..." so
# migrations run before the server; the bare server is the standalone default.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
