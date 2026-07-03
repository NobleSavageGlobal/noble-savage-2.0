# noble-savage-2.0

Noble Savage OS is an end-to-end personal assistant platform with a realtime command center.

This repository now includes:

- FastAPI backend for tasks, onboarding, signals, and websocket board updates.
- Next.js frontend for the live command center UI.
- Existing Python assistant starter package (kept for compatibility and testing).
- Operating contract in AGENTS.md.
- A runtime chief-of-staff assistant contract (problem-solving, proactive monitoring, tactical recommendations).
- Additive compendium module with scholars, plants, council convening, garden, texts, study path, and query endpoints.

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
- `docs/PERSONAL_OPERATING_AND_COUNCIL_SYSTEM.md`: personal-operating model, council routing, lunar flow, and daily briefing spec

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

To explicitly seed the personal operating and council system spec into the knowledge base:

```bash
cd backend
source .venv/bin/activate
python scripts/bootstrap_knowledge.py
```

### 2) Start frontend

```bash
cd frontend
npm install
## One-Command Release

- `./scripts/release_one_shot.sh`
- Runs full diagnostics, verifies main sync, deploys backend and frontend to Railway, then checks live endpoints.
npm run dev
```

Open `http://localhost:3000`.

The frontend expects the backend at `http://localhost:8000` by default.

## Codespaces Quick Test Link

If you are running inside GitHub Codespaces, use the helper script to start services (if needed), verify ports, and print ready-to-test links:

```bash
./scripts/dev_start_and_links.sh
```

This prints:

- Local frontend URL
- Local backend health URL
- Public frontend URL (port 3000 is set to public automatically)
- Backend forwarded URL (can remain private)

## Implemented API Surface

- `POST /api/knowledge/upload`

Compendium module (token required):

- `GET /comp/scholars`
- `GET /comp/scholar/:id`
- `GET /comp/scholar/:id/works`
- `GET /comp/scholar/:id/students`
- `GET /comp/scholar/:id/teachers`
- `GET /comp/council/convene?moment=...`
- `GET /comp/plants`
- `GET /comp/plant/:id`
- `GET /comp/plant/:id/safety`
- `GET /comp/plant/:id/evidence`
- `GET /comp/plant/:id/scholars`
- `GET /comp/garden/florida`
- `POST /comp/garden/design`
- `GET /comp/garden/calendar`
- `PATCH /comp/garden/plants/:id`
- `GET /comp/texts`
- `GET /comp/text/:id/references`
- `GET /comp/text/:id/cite?verse=...`
- `GET /comp/study/path`
- `POST /comp/study/advance`
- `GET /comp/study/recommend?level=...`
- `POST /comp/query`
- `POST /comp/briefing/digest`
- `GET /comp/briefing/recent?limit=...`
- `POST /comp/meals/context`
- `GET /comp/meals/today?limit=...`

## Development Notes

- `DATABASE_URL` controls the database driver and target.
- If `DATABASE_URL` is empty, local SQLite is used at `backend/noble_savage.db`.
- For Supabase/Postgres, set `DATABASE_URL` in `backend/.env` (see `backend/.env.example`).
- OpenRouter is used for assistant answers grounded on `/api/knowledge` retrieval.
- Configure `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `OPENROUTER_EMBEDDING_MODEL` in `backend/.env`.
- If `OPENROUTER_API_KEY` is missing, the assistant now returns an actionable configuration brief instead of a generic failure.
- Knowledge entries are embedded at ingest time and can be re-embedded with the API if needed.
- API routes under `/api/*` are protected with bearer auth (except auth/register/login).
- WebSocket board channel requires `?token=<jwt>` query parameter.
- Task create/update events are broadcast over websocket for live UI updates.
- This is the first shipping slice; next iterations can layer Supabase Auth/Realtimes, agent orchestration, and cadence jobs without reworking structure.

## Legacy Assistant Package

The original package remains available:

```bash
python -m personal_assistant_ai.cli
python -m unittest discover -s tests -p "test_*.py"
```

Compendium smoke validation:

```bash
cd backend
source .venv/bin/activate
python scripts/smoke_compendium_flow.py
```

## Assistant Runtime Contract

The `/api/assistant/query` path is configured to operate as a chief-of-staff style assistant that:

- Solves underlying problems rather than only answering questions.
- Proactively surfaces blockers, risks, and next actions.
- Produces tactical recommendations for decisions, including confidence, second-order consequence, and one critical risk.
- Uses knowledge entries as primary factual grounding and asks one sharp follow-up when critical facts are missing.
