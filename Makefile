# =============================================================================
# VaniAI — developer workflow shortcuts
# =============================================================================
#
# Requires GNU make. On Windows install it once with:
#     winget install GnuWin32.Make        (or: choco install make)
# then run e.g. `make up` from PowerShell / cmd / Git Bash.
#
# No make? Every target is a thin wrapper — run the raw commands instead:
#
#   install       cd backend  && pip install -r requirements.txt
#                 cd frontend && npm install
#   dev-backend   cd backend  && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#   dev-frontend  cd frontend && npm run dev
#   seed          cd backend  && python -m scripts.seed
#   train         cd backend  && python -m ml.training.train --dataset ../data/sample_students.csv
#   test          cd backend  && pytest
#   lint          cd backend  && ruff check .
#                 cd frontend && npm run typecheck
#   up            docker compose up -d --build
#   down          docker compose down
#   logs          docker compose logs -f --tail=200
#
# Local dev expects PostgreSQL per backend/.env.example (or point DATABASE_URL
# at your own instance). `make train` needs data/sample_students.csv — generate
# it with:  cd backend && python -m ml.data.generate_dataset --rows 2000 --out ../data/sample_students.csv
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help install dev-backend dev-frontend seed train test lint up down logs

help:
	@echo VaniAI targets:
	@echo   make install       - install backend pip deps and frontend npm deps
	@echo   make dev-backend   - run FastAPI with auto-reload on port 8000
	@echo   make dev-frontend  - run the Vite dev server on port 5173
	@echo   make seed          - create demo users, students and a trained model
	@echo   make train         - train and register a model from data/sample_students.csv
	@echo   make test          - run the backend pytest suite
	@echo   make lint          - ruff check backend + typecheck frontend
	@echo   make up            - docker compose up -d --build
	@echo   make down          - docker compose down
	@echo   make logs          - tail docker compose logs

## Install backend (pip) and frontend (npm) dependencies.
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

## Run the FastAPI backend with auto-reload (http://localhost:8000/docs).
dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

## Run the Vite dev server (http://localhost:5173, proxies /api to :8000).
dev-frontend:
	cd frontend && npm run dev

## Seed demo accounts, 150 students, dataset and a trained model (idempotent).
seed:
	cd backend && python -m scripts.seed

## Train candidate models and register/activate the best one.
train:
	cd backend && python -m ml.training.train --dataset ../data/sample_students.csv

## Run the backend test suite.
test:
	cd backend && pytest

## Lint backend (ruff) and typecheck frontend (tsc).
lint:
	cd backend && ruff check .
	cd frontend && npm run typecheck

## Build and start the full stack in the background.
up:
	docker compose up -d --build

## Stop the stack (keeps named volumes; add -v manually to wipe data).
down:
	docker compose down

## Tail logs from all services.
logs:
	docker compose logs -f --tail=200
