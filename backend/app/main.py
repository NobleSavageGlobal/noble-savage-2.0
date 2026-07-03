import asyncio
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import create_access_token, decode_access_token, hash_password, verify_password
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
from .onboarding import handle_turn
from .schemas import (
    AssistantQueryIn,
    AssistantQueryOut,
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
    TaskCreate,
    TaskOut,
    TaskPatch,
    UserOut,
    WorkstreamOut,
)
from .store import (
    create_knowledge,
    create_user,
    create_signal,
    create_task,
    get_user_by_email,
    get_user_by_id,
    get_onboarding,
    init_db,
    list_tasks,
    list_knowledge,
    list_workstreams,
    patch_task,
    save_onboarding,
    search_knowledge,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
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


@app.get("/health", response_model=MessageOut)
async def health() -> MessageOut:
    return MessageOut(message="ok")


@app.post("/api/auth/register", response_model=AuthTokenOut)
async def auth_register(payload: AuthRegisterIn) -> AuthTokenOut:
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
async def auth_login(payload: AuthLoginIn) -> AuthTokenOut:
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


@app.get("/api/knowledge", response_model=list[KnowledgeOut])
async def get_knowledge(user: dict[str, Any] = Depends(current_user)) -> list[KnowledgeOut]:
    return [KnowledgeOut(**k) for k in list_knowledge(user["id"]) ]


@app.post("/api/knowledge", response_model=KnowledgeOut)
async def add_knowledge(payload: KnowledgeIn, user: dict[str, Any] = Depends(current_user)) -> KnowledgeOut:
    record = create_knowledge(user["id"], payload.model_dump(mode="json"))
    return KnowledgeOut(**record)


@app.post("/api/knowledge/{knowledge_id}/reembed", response_model=KnowledgeOut)
async def reembed_knowledge(
    knowledge_id: str, user: dict[str, Any] = Depends(current_user)
) -> KnowledgeOut:
    record = update_knowledge_embedding(user["id"], knowledge_id)
    if not record:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return KnowledgeOut(**record)


@app.post("/api/assistant/query", response_model=AssistantQueryOut)
async def assistant_query(
    payload: AssistantQueryIn, user: dict[str, Any] = Depends(current_user)
) -> AssistantQueryOut:
    citations = search_knowledge(user["id"], payload.question, limit=5)
    try:
        answer = await query_openrouter(payload.question, citations)
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
    task = create_task(user["id"], payload.model_dump(mode="json"))
    asyncio.create_task(manager.broadcast({"type": "task.created", "task": task}, user["id"]))
    return TaskOut(**task)


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str, payload: TaskPatch, user: dict[str, Any] = Depends(current_user)
) -> TaskOut:
    task = patch_task(user["id"], task_id, payload.model_dump(mode="json"))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    asyncio.create_task(manager.broadcast({"type": "task.updated", "task": task}, user["id"]))
    return TaskOut(**task)


@app.post("/api/signals", response_model=MessageOut)
async def add_signal(payload: SignalCreate, user: dict[str, Any] = Depends(current_user)) -> MessageOut:
    create_signal(user["id"], payload.model_dump(mode="json"))
    return MessageOut(message="signal recorded")


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
