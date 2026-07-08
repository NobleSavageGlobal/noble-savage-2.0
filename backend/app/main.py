import asyncio
from datetime import date
from datetime import datetime, timezone
import logging
import os
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import JWT_SECRET_FROM_ENV, create_access_token, decode_access_token, hash_password, verify_password
from .assistant_service import query_openrouter
from .compendium_store import (
    advance_study,
    create_briefing_digest,
    create_meal_context,
    comp_query,
    convene_council,
    design_garden,
    get_florida_garden,
    get_garden_calendar,
    get_plant,
    get_plant_evidence,
    get_plant_safety,
    get_plant_scholars,
    get_scholar,
    get_scholar_students,
    get_scholar_teachers,
    get_scholar_works,
    get_study_path,
    get_text_cite,
    get_text_references,
    init_compendium_db,
    list_plants,
    list_recent_briefings,
    list_recent_meals,
    list_scholars,
    list_texts,
    patch_garden_plant,
    recommend_study,
    seed_compendium_defaults,
)
from .domain_intelligence import analyze_document, intelligence_brief_markdown
from .onboarding import handle_turn
from .knowledge_ingest import build_knowledge_payloads, parse_document
from .schemas import (
    AssistantQueryIn,
    AssistantQueryOut,
    AssistantRuntimeOut,
    AssistantContextOut,
    DecisionCreate,
    DecisionOut,
    DecisionTrendPointOut,
    DecisionWeeklySummaryOut,
    CompBriefingIn,
    CompGardenDesignIn,
    CompGardenPlantPatchIn,
    CompMealContextIn,
    CompQueryIn,
    CompStudyAdvanceIn,
    AuthLoginIn,
    AuthRegisterIn,
    AuthTokenOut,
    KnowledgeIn,
    KnowledgeOut,
    MessageOut,
    OnboardingState,
    OnboardingTurnIn,
    OnboardingTurnOut,
    SignalCreate,
    SignalOut,
    TaskCreate,
    TaskOut,
    TaskPatch,
    UserOut,
    WorkstreamPatch,
    WorkstreamOut,
)
from .store import (
    create_decision,
    create_knowledge,
    create_user,
    create_signal,
    create_task,
    delete_task,
    get_user_by_email,
    get_user_by_id,
    get_decision_weekly_summary,
    get_decision_trend,
    get_onboarding,
    init_db,
    list_signals,
    list_tasks,
    list_decisions,
    list_knowledge,
    list_workstreams,
    patch_workstream,
    patch_task,
    save_onboarding,
    search_knowledge,
    reembed_knowledge_file,
    update_knowledge_embedding,
)


class ConnectionManager:
    def __init__(self) -> None:
        self._clients_by_user: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self._clients_by_user:
            self._clients_by_user[user_id] = set()
        self._clients_by_user[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        clients = self._clients_by_user.get(user_id)
        if not clients:
            return
        clients.discard(websocket)
        if not clients:
            self._clients_by_user.pop(user_id, None)

    async def broadcast(self, payload: dict[str, Any], user_id: str) -> None:
        clients = self._clients_by_user.get(user_id, set())
        dead: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
            except Exception:
                dead.append(client)
        for client in dead:
            self.disconnect(client, user_id)


manager = ConnectionManager()
app = FastAPI(title="Noble Savage API", version="0.1.0")
security = HTTPBearer()
logger = logging.getLogger(__name__)
AUTH_RATE_LIMIT_WINDOW_SEC = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SEC", "60"))
AUTH_RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "12"))
_auth_attempts: dict[str, deque[float]] = defaultdict(deque)


def _allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS", "")
    parsed = [entry.strip() for entry in configured.split(",") if entry.strip()]
    defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://noble-savage-frontend-production.up.railway.app",
    ]
    for origin in defaults:
        if origin not in parsed:
            parsed.append(origin)
    return parsed

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_auth_rate_limit(request: Request) -> None:
    now = time.time()
    key = _get_client_ip(request)
    attempts = _auth_attempts[key]
    while attempts and now - attempts[0] > AUTH_RATE_LIMIT_WINDOW_SEC:
        attempts.popleft()
    if len(attempts) >= AUTH_RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many authentication attempts. Please retry shortly.")
    attempts.append(now)


@app.on_event("startup")
def on_startup() -> None:
    production_like = bool(os.getenv("RAILWAY_ENVIRONMENT")) or os.getenv("ENV") == "production"
    if production_like and not JWT_SECRET_FROM_ENV:
        raise RuntimeError("JWT_SECRET must be explicitly configured in production environments.")

    init_db()
    init_compendium_db()
    seed_compendium_defaults()


def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict[str, Any]:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _build_operational_snapshot(user_id: str) -> str:
    tasks = list_tasks(user_id)
    workstreams = list_workstreams(user_id)
    onboarding = get_onboarding(user_id)
    decisions = list_decisions(user_id, limit=5)
    signals = list_signals(user_id, limit=5)

    open_p1 = [task for task in tasks if task["prio"] == "P1" and task["status"] != "Done"]
    blocked = [task for task in tasks if task["status"] == "Blocked"]
    this_week = [task for task in tasks if task["status"] == "This Week"]
    in_progress = [task for task in tasks if task["status"] == "In Progress"]
    done = [task for task in tasks if task["status"] == "Done"]

    lines = [
        f"Timestamp: {datetime.now(timezone.utc).isoformat()}",
        f"Workstreams: {len(workstreams)} loaded",
        f"Tasks: {len(tasks)} total | {len(open_p1)} open P1 | {len(blocked)} blocked | {len(this_week)} this week | {len(in_progress)} in progress | {len(done)} done",
        f"Onboarding: step={onboarding['step']} complete={onboarding['complete']}",
    ]

    if open_p1:
        lines.append("Top priority tasks:")
        for task in open_p1[:3]:
            lines.append(f"- {task['task']} [{task['status']}] ({task['ws']})")

    if blocked:
        lines.append("Blocked tasks:")
        for task in blocked[:3]:
            lines.append(f"- {task['task']} ({task['ws']})")

    if decisions:
        lines.append("Recent decisions:")
        for decision in decisions[:3]:
            lines.append(f"- {decision['status']}: {decision['prompt'][:120]}")

    if signals:
        lines.append("Recent signals:")
        for signal in signals[:3]:
            lines.append(f"- {signal['kind']} -> {signal.get('target') or 'unknown target'}")

    return "\n".join(lines)


@app.get("/health", response_model=MessageOut)
async def health() -> MessageOut:
    return MessageOut(message="ok")


@app.get("/api/health")
async def api_health(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    tasks = list_tasks(user["id"])
    blocked = sum(1 for task in tasks if task["status"] == "Blocked")
    open_p1 = sum(1 for task in tasks if task["prio"] == "P1" and task["status"] != "Done")
    return {
        "status": "up",
        "degraded": blocked > 0,
        "time": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "tasks_total": len(tasks),
            "open_p1": open_p1,
            "blocked": blocked,
        },
    }


@app.post("/api/auth/register", response_model=AuthTokenOut)
async def auth_register(payload: AuthRegisterIn, request: Request) -> AuthTokenOut:
    _enforce_auth_rate_limit(request)
    try:
        user = create_user(
            email=payload.email,
            password_hash=hash_password(payload.password),
            name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    token = create_access_token(user["id"], user["email"])
    return AuthTokenOut(access_token=token)


@app.post("/api/auth/login", response_model=AuthTokenOut)
async def auth_login(payload: AuthLoginIn, request: Request) -> AuthTokenOut:
    _enforce_auth_rate_limit(request)
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["email"])
    return AuthTokenOut(access_token=token)


@app.get("/api/auth/me", response_model=UserOut)
async def auth_me(user: dict[str, Any] = Depends(current_user)) -> UserOut:
    return UserOut(id=user["id"], email=user["email"], name=user.get("name"))


@app.get("/api/workstreams", response_model=list[WorkstreamOut])
async def get_workstreams(user: dict[str, Any] = Depends(current_user)) -> list[WorkstreamOut]:
    return [WorkstreamOut(**ws) for ws in list_workstreams(user["id"])]


@app.patch("/api/workstreams/{workstream_id}", response_model=WorkstreamOut)
async def update_workstream(
    workstream_id: str,
    payload: WorkstreamPatch,
    user: dict[str, Any] = Depends(current_user),
) -> WorkstreamOut:
    patch_data = payload.model_dump(exclude_none=True)
    if not patch_data:
        raise HTTPException(status_code=400, detail="At least one field is required")

    updated = patch_workstream(user["id"], workstream_id, patch_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Workstream not found")
    return WorkstreamOut(**updated)


@app.get("/api/knowledge", response_model=list[KnowledgeOut])
async def get_knowledge(user: dict[str, Any] = Depends(current_user)) -> list[KnowledgeOut]:
    return [KnowledgeOut(**k) for k in list_knowledge(user["id"]) ]


@app.post("/api/knowledge", response_model=KnowledgeOut)
async def add_knowledge(payload: KnowledgeIn, user: dict[str, Any] = Depends(current_user)) -> KnowledgeOut:
    record = create_knowledge(user["id"], payload.model_dump(mode="json"))
    return KnowledgeOut(**record)


@app.post("/api/knowledge/upload")
async def upload_knowledge(
    files: list[UploadFile] = File(...), user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    successful_files = 0
    failed_files = 0
    total_entries_created = 0
    uploaded: list[dict[str, Any]] = []
    intelligence_reports: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for file in files:
        filename = file.filename or "upload"
        stage = "uploading"
        try:
            data = await file.read()
            stage = "parsing"
            parsed = parse_document(filename, file.content_type, data)
            stage = "chunking"
            payloads = build_knowledge_payloads(parsed)
            stage = "embedding"
            intelligence = analyze_document(parsed.title, parsed.content)
            intelligence_payload = {
                "title": f"{parsed.title} (Intelligence Brief)",
                "content": intelligence_brief_markdown(intelligence),
                "source": parsed.source,
                "tags": list(dict.fromkeys([*(parsed.tags or []), "intelligence", intelligence.domain, intelligence.doc_type, intelligence.severity.lower()])),
                "file_id": parsed.file_id,
                "chunk_index": parsed.chunk_count + 1,
                "chunk_total": parsed.chunk_count + 1,
                "token_count": len(intelligence_brief_markdown(intelligence).split()),
                "status": "indexed",
            }

            stage = "indexing"
            for payload in payloads:
                create_knowledge(user["id"], payload)
            create_knowledge(user["id"], intelligence_payload)

            successful_files += 1
            total_entries_created += len(payloads) + 1
            uploaded.append(
                {
                    "filename": filename,
                    "file_id": parsed.file_id,
                    "status": "indexed",
                    "status_chip": "ready",
                    "entries_created": len(payloads) + 1,
                    "chunk_count": parsed.chunk_count + 1,
                    "token_count": parsed.token_count + intelligence_payload["token_count"],
                    "warnings": parsed.warnings,
                    "ocr_used": parsed.ocr_used,
                    "last_indexed": datetime.now(timezone.utc).isoformat(),
                }
            )
            intelligence_reports.append(
                {
                    "filename": filename,
                    "file_id": parsed.file_id,
                    "doc_type": intelligence.doc_type,
                    "domain": intelligence.domain,
                    "severity": intelligence.severity,
                    "deadline": intelligence.deadline,
                    "diagnosis": intelligence.diagnosis,
                    "action": intelligence.action,
                    "risk": intelligence.risk,
                    "authorities": intelligence.authorities,
                }
            )
        except ValueError as exc:
            failed_files += 1
            errors.append({"filename": filename, "stage": stage, "status": "failed", "error": str(exc)})
        except Exception:
            failed_files += 1
            logger.exception("Unexpected error while processing uploaded file: %s", filename)
            errors.append({"filename": filename, "stage": stage, "status": "failed", "error": "Unexpected upload error"})

    return {
        "successful_files": successful_files,
        "failed_files": failed_files,
        "total_entries_created": total_entries_created,
        "uploaded": uploaded,
        "intelligence_reports": intelligence_reports,
        "errors": errors,
    }


@app.post("/api/knowledge/{knowledge_id}/reembed", response_model=KnowledgeOut)
async def reembed_knowledge(
    knowledge_id: str, user: dict[str, Any] = Depends(current_user)
) -> KnowledgeOut:
    record = update_knowledge_embedding(user["id"], knowledge_id)
    if not record:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return KnowledgeOut(**record)


@app.post("/api/knowledge/reindex-file/{file_id}")
async def reindex_knowledge_file(file_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    result = reembed_knowledge_file(user["id"], file_id)
    return result


@app.post("/api/assistant/query", response_model=AssistantQueryOut)
async def assistant_query(
    payload: AssistantQueryIn, user: dict[str, Any] = Depends(current_user)
) -> AssistantQueryOut:
    citations = search_knowledge(
        user["id"],
        payload.question,
        limit=8,
        file_ids=payload.knowledge_file_ids or None,
    )
    try:
        completion = await query_openrouter(
            payload.question,
            citations,
            operational_context=_build_operational_snapshot(user["id"]),
            proactive=False,
            mode=payload.mode,
            model=payload.model,
            include_runtime=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if isinstance(completion, dict):
        answer = completion.get("answer") or ""
        runtime = completion.get("runtime") or {}
    else:
        answer = completion
        runtime = {}

    knowledge_files = list(
        dict.fromkeys([
            c.get("title", "") for c in citations if c.get("title")
        ])
    )

    return AssistantQueryOut(
        answer=answer,
        citations=[KnowledgeOut(**c) for c in citations],
        runtime=AssistantRuntimeOut(**runtime) if runtime else None,
        context=AssistantContextOut(citations_used=len(citations), knowledge_files=knowledge_files),
    )


@app.get("/api/assistant/briefing", response_model=AssistantQueryOut)
async def assistant_briefing(user: dict[str, Any] = Depends(current_user)) -> AssistantQueryOut:
    snapshot = _build_operational_snapshot(user["id"])
    citations = search_knowledge(user["id"], "proactive operating brief", limit=3)
    try:
        answer = await query_openrouter(
            "Produce a proactive operating brief with the single highest-leverage action, blockers, risks, and one recommended next update.",
            citations,
            operational_context=snapshot,
            proactive=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return AssistantQueryOut(
        answer=answer,
        citations=[KnowledgeOut(**c) for c in citations],
    )


@app.get("/comp/scholars")
async def comp_scholars(
    field: str | None = Query(default=None),
    tradition: str | None = Query(default=None),
    era: str | None = Query(default=None),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    _ = user
    return list_scholars(field=field, tradition=tradition, era=era)


@app.get("/comp/scholar/{scholar_id}")
async def comp_scholar(scholar_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    _ = user
    scholar = get_scholar(scholar_id)
    if not scholar:
        raise HTTPException(status_code=404, detail="Scholar not found")
    return scholar


@app.get("/comp/scholar/{scholar_id}/works")
async def comp_scholar_works(
    scholar_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_scholar_works(scholar_id)


@app.get("/comp/scholar/{scholar_id}/students")
async def comp_scholar_students(
    scholar_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_scholar_students(scholar_id)


@app.get("/comp/scholar/{scholar_id}/teachers")
async def comp_scholar_teachers(
    scholar_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_scholar_teachers(scholar_id)


@app.get("/comp/council/convene")
async def comp_council_convene(
    moment: str = Query(default="morning_briefing"),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    return convene_council(user["id"], moment)


@app.get("/comp/plants")
async def comp_plants(
    search: str | None = Query(default=None), user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return list_plants(search)


@app.get("/comp/plant/{plant_id}")
async def comp_plant(plant_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    _ = user
    plant = get_plant(plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@app.get("/comp/plant/{plant_id}/safety")
async def comp_plant_safety(
    plant_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_plant_safety(plant_id)


@app.get("/comp/plant/{plant_id}/evidence")
async def comp_plant_evidence(
    plant_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_plant_evidence(plant_id)


@app.get("/comp/plant/{plant_id}/scholars")
async def comp_plant_scholars(
    plant_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_plant_scholars(plant_id)


@app.get("/comp/garden/florida")
async def comp_garden_florida(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return get_florida_garden(user["id"])


@app.post("/comp/garden/design")
async def comp_garden_design(
    payload: CompGardenDesignIn, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return design_garden(user["id"], payload.model_dump(mode="json"))


@app.get("/comp/garden/calendar")
async def comp_garden_calendar(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return get_garden_calendar(user["id"])


@app.patch("/comp/garden/plants/{garden_plant_id}")
async def comp_patch_garden_plant(
    garden_plant_id: str,
    payload: CompGardenPlantPatchIn,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    patched = patch_garden_plant(user["id"], garden_plant_id, payload.model_dump(mode="json"))
    if not patched:
        raise HTTPException(status_code=404, detail="Garden plant not found")
    return patched


@app.get("/comp/texts")
async def comp_texts(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    _ = user
    return list_texts()


@app.get("/comp/text/{text_id}/references")
async def comp_text_references(
    text_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return get_text_references(text_id)


@app.get("/comp/text/{text_id}/cite")
async def comp_text_cite(
    text_id: str, verse: str = Query(...), user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    _ = user
    return get_text_cite(text_id, verse)


@app.get("/comp/study/path")
async def comp_study_path(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return get_study_path(user["id"])


@app.post("/comp/study/advance")
async def comp_study_advance(
    payload: CompStudyAdvanceIn, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return advance_study(user["id"], payload.model_dump(mode="json"))


@app.get("/comp/study/recommend")
async def comp_study_recommend(
    level: str = Query(default="intermediate"), user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    _ = user
    return recommend_study(level)


@app.post("/comp/query")
async def comp_query_route(
    payload: CompQueryIn, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return comp_query(user["id"], payload.query, search_knowledge)


@app.post("/comp/briefing/digest")
async def comp_briefing_digest(
    payload: CompBriefingIn, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return create_briefing_digest(user["id"], payload.moment, payload.focus)


@app.get("/comp/briefing/recent")
async def comp_briefing_recent(
    limit: int = Query(default=5, ge=1, le=20),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    return list_recent_briefings(user["id"], limit)


@app.post("/comp/meals/context")
async def comp_meal_context(
    payload: CompMealContextIn, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return create_meal_context(user["id"], payload.model_dump(mode="json"))


@app.get("/comp/meals/today")
async def comp_meals_today(
    limit: int = Query(default=5, ge=1, le=20),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    return list_recent_meals(user["id"], limit)


@app.get("/api/tasks", response_model=list[TaskOut])
async def get_tasks(
    filter: str | None = Query(default=None), user: dict[str, Any] = Depends(current_user)
) -> list[TaskOut]:
    return [TaskOut(**t) for t in list_tasks(user["id"], filter)]


@app.post("/api/tasks", response_model=TaskOut)
async def add_task(payload: TaskCreate, user: dict[str, Any] = Depends(current_user)) -> TaskOut:
    try:
        task = create_task(user["id"], payload.model_dump(mode="json"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    asyncio.create_task(manager.broadcast({"type": "task.created", "task": task}, user["id"]))
    return TaskOut(**task)


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str, payload: TaskPatch, user: dict[str, Any] = Depends(current_user)
) -> TaskOut:
    try:
        task = patch_task(user["id"], task_id, payload.model_dump(mode="json"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    asyncio.create_task(manager.broadcast({"type": "task.updated", "task": task}, user["id"]))
    return TaskOut(**task)


@app.delete("/api/tasks/{task_id}", response_model=MessageOut)
async def remove_task(task_id: str, user: dict[str, Any] = Depends(current_user)) -> MessageOut:
    deleted = delete_task(user["id"], task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    asyncio.create_task(manager.broadcast({"type": "task.deleted", "task_id": task_id}, user["id"]))
    return MessageOut(message="task deleted")


@app.post("/api/decisions", response_model=DecisionOut)
async def add_decision(payload: DecisionCreate, user: dict[str, Any] = Depends(current_user)) -> DecisionOut:
    decision = create_decision(user["id"], payload.model_dump(mode="json"))
    return DecisionOut(**decision)


@app.get("/api/decisions", response_model=list[DecisionOut])
async def get_decisions(
    limit: int = Query(default=25, ge=1, le=200),
    week_of: str | None = Query(default=None),
    user: dict[str, Any] = Depends(current_user),
) -> list[DecisionOut]:
    week_of_date = None
    if week_of:
        try:
            week_of_date = date.fromisoformat(week_of)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid week_of date") from exc
    decisions = list_decisions(user["id"], limit=limit, week_of=week_of_date)
    return [DecisionOut(**d) for d in decisions]


@app.get("/api/decisions/weekly-summary", response_model=DecisionWeeklySummaryOut)
async def get_decisions_weekly_summary(
    week_of: str = Query(...),
    user: dict[str, Any] = Depends(current_user),
) -> DecisionWeeklySummaryOut:
    try:
        week_of_date = date.fromisoformat(week_of)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid week_of date") from exc

    summary = get_decision_weekly_summary(user["id"], week_of_date)
    return DecisionWeeklySummaryOut(**summary)


@app.get("/api/decisions/trend", response_model=list[DecisionTrendPointOut])
async def get_decisions_trend(
    weeks: int = Query(default=8, ge=1, le=52),
    user: dict[str, Any] = Depends(current_user),
) -> list[DecisionTrendPointOut]:
    trend = get_decision_trend(user["id"], weeks=weeks)
    return [DecisionTrendPointOut(**point) for point in trend]


@app.post("/api/signals", response_model=MessageOut)
async def add_signal(payload: SignalCreate, user: dict[str, Any] = Depends(current_user)) -> MessageOut:
    create_signal(user["id"], payload.model_dump(mode="json"))
    return MessageOut(message="signal recorded")


@app.get("/api/signals", response_model=list[SignalOut])
async def get_signals(
    limit: int = Query(default=25, ge=1, le=200),
    user: dict[str, Any] = Depends(current_user),
) -> list[SignalOut]:
    return [SignalOut(**signal) for signal in list_signals(user["id"], limit=limit)]


@app.get("/api/onboarding", response_model=OnboardingState)
async def onboarding_get(user: dict[str, Any] = Depends(current_user)) -> OnboardingState:
    return OnboardingState(**get_onboarding(user["id"]))


@app.post("/api/onboarding", response_model=OnboardingState)
async def onboarding_post(
    payload: OnboardingState, user: dict[str, Any] = Depends(current_user)
) -> OnboardingState:
    saved = save_onboarding(user["id"], payload.model_dump(mode="json"))
    return OnboardingState(**saved)


@app.post("/api/onboarding/turn", response_model=OnboardingTurnOut)
async def onboarding_turn(
    payload: OnboardingTurnIn, user: dict[str, Any] = Depends(current_user)
) -> OnboardingTurnOut:
    current = get_onboarding(user["id"])
    response = handle_turn(user["id"], current, payload.answer)

    # Keep board in sync when onboarding confirms chokepoint and creates a task.
    if response.get("step") == "rhythm":
        tasks = list_tasks(user["id"], "This Week")
        if tasks:
            newest = tasks[0]
            asyncio.create_task(
                manager.broadcast({"type": "task.created", "task": newest}, user["id"])
            )

    return OnboardingTurnOut(**response)


@app.post("/api/onboarding/reset", response_model=OnboardingState)
async def onboarding_reset(user: dict[str, Any] = Depends(current_user)) -> OnboardingState:
    saved = save_onboarding(user["id"], {"step": "orient", "complete": False, "collected": {}})
    return OnboardingState(**saved)


@app.websocket("/ws/board")
async def board_ws(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing subject")
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
