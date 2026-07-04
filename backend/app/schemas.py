from datetime import datetime, date
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


TaskPriority = Literal["P1", "P2", "P3"]
TaskStatus = Literal["Backlog", "This Week", "In Progress", "Blocked", "Done"]
SignalKind = Literal["accept", "edit", "dismiss", "correct", "gap"]


class TaskCreate(BaseModel):
    ws: str = Field(min_length=1, max_length=120)
    task: str = Field(min_length=1, max_length=500)
    prio: TaskPriority = "P2"
    status: TaskStatus = "Backlog"
    owner: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)
    deleg: str | None = Field(default=None, max_length=4000)
    bot: str | None = Field(default=None, max_length=120)
    due: date | None = None


class TaskPatch(BaseModel):
    ws: str | None = Field(default=None, min_length=1, max_length=120)
    task: str | None = Field(default=None, min_length=1, max_length=500)
    prio: TaskPriority | None = None
    status: TaskStatus | None = None
    owner: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)
    deleg: str | None = Field(default=None, max_length=4000)
    bot: str | None = Field(default=None, max_length=120)
    due: date | None = None


class TaskOut(BaseModel):
    id: str
    ws: str
    task: str
    prio: TaskPriority
    status: TaskStatus
    owner: str | None
    notes: str | None
    deleg: str | None
    bot: str | None
    due: date | None
    created_at: datetime
    updated_at: datetime


class SignalCreate(BaseModel):
    kind: SignalKind
    target: str | None = Field(default=None, max_length=300)
    before: str | None = Field(default=None, max_length=4000)
    after: str | None = Field(default=None, max_length=4000)
    agent: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)


class OnboardingState(BaseModel):
    step: str
    complete: bool = False
    collected: dict = Field(default_factory=dict)


class OnboardingTurnIn(BaseModel):
    answer: str | None = None


class OnboardingTurnOut(BaseModel):
    step: str
    question: str
    note: str | None = None
    proposals: list[dict[str, Any]] = Field(default_factory=list)
    summary: list[str] = Field(default_factory=list)
    complete: bool = False


class AuthRegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    name: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Invalid email format")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        checks = [
            re.search(r"[a-z]", value),
            re.search(r"[A-Z]", value),
            re.search(r"\d", value),
            re.search(r"[^A-Za-z0-9]", value),
        ]
        if not all(checks):
            raise ValueError(
                "Password must include upper, lower, digit, and special character"
            )
        return value


class AuthLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Invalid email format")
        return normalized


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None = None


class WorkstreamOut(BaseModel):
    id: str
    name: str
    tier: str | None = None
    owner: str | None = None
    objective: str | None = None
    why: str | None = None
    color: str | None = None


class WorkstreamPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    tier: str | None = Field(default=None, max_length=80)
    owner: str | None = Field(default=None, max_length=120)
    objective: str | None = Field(default=None, max_length=4000)
    why: str | None = Field(default=None, max_length=4000)
    color: str | None = Field(default=None, max_length=20)


class MessageOut(BaseModel):
    message: str


class DecisionCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    recommendation: Any | None = None
    actual_action: str | None = Field(default=None, max_length=4000)
    status: Literal["DONE", "IN MOTION", "STILL BLUEPRINT"]
    week_of: date | None = None


class DecisionOut(BaseModel):
    id: str
    prompt: str
    recommendation: Any | None = None
    actual_action: str | None = None
    status: Literal["DONE", "IN MOTION", "STILL BLUEPRINT"]
    week_of: date | None = None
    ts: datetime


class DecisionWeeklySummaryOut(BaseModel):
    week_of: date
    done: int
    in_motion: int
    still_blueprint: int
    total: int
    ship_to_plan_ratio: float


class DecisionTrendPointOut(BaseModel):
    week_of: date
    done: int
    in_motion: int
    still_blueprint: int
    total: int
    ship_to_plan_ratio: float


class SignalOut(BaseModel):
    id: str
    kind: SignalKind
    target: str | None = None
    before: str | None = None
    after: str | None = None
    agent: str | None = None
    notes: str | None = None
    ts: datetime


class KnowledgeIn(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    source: str | None = None
    tags: list[str] = Field(default_factory=list)


class KnowledgeOut(BaseModel):
    id: str
    title: str
    content: str
    source: str | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: datetime


class AssistantQueryIn(BaseModel):
    question: str = Field(min_length=1)


class AssistantQueryOut(BaseModel):
    answer: str
    citations: list[KnowledgeOut] = Field(default_factory=list)


class CompGardenDesignIn(BaseModel):
    name: str | None = None
    location: str = "Florida"
    tradition_weights: dict[str, float] = Field(default_factory=dict)
    square_feet: int | None = None
    usda_zone: str | None = None
    sun_exposure: str | None = None
    goals: list[str] = Field(default_factory=list)


class CompGardenPlantPatchIn(BaseModel):
    action: str = "update"
    quantity: int | None = None
    position: str | None = None
    notes: str | None = None


class CompStudyAdvanceIn(BaseModel):
    scholar_id: str | None = None
    text_id: str | None = None
    level: str = "intermediate"


class CompQueryIn(BaseModel):
    query: str = Field(min_length=1)


class CompBriefingIn(BaseModel):
    moment: str = "morning_briefing"
    focus: str | None = None


class CompMealContextIn(BaseModel):
    meal_name: str = Field(min_length=1)
    ingredients: list[str] = Field(default_factory=list)
    notes: str | None = None
