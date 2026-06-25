# noble-savage-2.0

Noble Savage OS is an end-to-end personal assistant platform with a realtime command center.

This repository now includes:

- FastAPI backend for tasks, onboarding, signals, and websocket board updates.
- Next.js frontend for the live command center UI.
- Existing Python assistant starter package (kept for compatibility and testing).
- Operating contract in AGENTS.md.

## Current Architecture

- Frontend: Next.js (App Router)
- Backend: FastAPI
- Data: SQLAlchemy with `DATABASE_URL` (`SQLite` local fallback, `Postgres`/Supabase ready)
- Realtime: WebSocket (`/ws/board`)

## Repository Layout

- `frontend/`: Next.js command center UI
- `backend/`: FastAPI API service
- `AGENTS.md`: product and agent operating contract
- `personal_assistant_ai/`: legacy assistant starter package
- `tests/`: unit tests for legacy assistant package

## Run Locally

Prerequisites:

- Python 3.10+
- Node.js 20+

### 1) Start backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/init_db.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional (explicitly reseed default workstreams):

```bash
cd backend
source .venv/bin/activate
python scripts/seed_workstreams.py
python scripts/bootstrap_knowledge.py
```

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend expects the backend at `http://localhost:8000` by default.

## Implemented API Surface

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/workstreams`
- `GET /api/knowledge`
- `POST /api/knowledge`
- `POST /api/assistant/query`
- `GET /api/tasks?filter=...`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/signals`
- `GET /api/onboarding`
- `POST /api/onboarding`
- `POST /api/onboarding/turn`
- `POST /api/onboarding/reset`
- `WS /ws/board`

## Development Notes

- `DATABASE_URL` controls the database driver and target.
- If `DATABASE_URL` is empty, local SQLite is used at `backend/noble_savage.db`.
- For Supabase/Postgres, set `DATABASE_URL` in `backend/.env` (see `backend/.env.example`).
- OpenRouter is used for assistant answers grounded on `/api/knowledge` retrieval.
- Configure `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `OPENROUTER_EMBEDDING_MODEL` in `backend/.env`.
- Knowledge entries are embedded at ingest time and can be re-embedded with the API if needed.
- API routes under `/api/*` are protected with bearer auth (except auth/register/login).
- WebSocket board channel requires `?token=<jwt>` query parameter.
- Task create/update events are broadcast over websocket for live UI updates.
- This is the first shipping slice; next iterations can layer Supabase Auth/Realtimes, agent orchestration, and cadence jobs without reworking structure.

## Verification

Run an end-to-end backend flow test (health, auth, onboarding, websocket, tenant isolation):

```bash
cd backend
source .venv/bin/activate
python scripts/e2e_system_flow.py
```

## Legacy Assistant Package

The original package remains available:

```bash
python -m personal_assistant_ai.cli
python -m unittest discover -s tests -p "test_*.py"
```
