from datetime import datetime, date
from typing import Any, Literal

from pydantic import BaseModel, Field


TaskPriority = Literal["P1", "P2", "P3"]
TaskStatus = Literal["Backlog", "This Week", "In Progress", "Blocked", "Done"]
SignalKind = Literal["accept", "edit", "dismiss", "correct", "gap"]


class TaskCreate(BaseModel):
    ws: str
    task: str = Field(min_length=1)
    prio: TaskPriority = "P2"
    status: TaskStatus = "Backlog"
    owner: str | None = None
    notes: str | None = None
    deleg: str | None = None
    bot: str | None = None
    due: date | None = None


class TaskPatch(BaseModel):
    task: str | None = None
    prio: TaskPriority | None = None
    status: TaskStatus | None = None
    owner: str | None = None
    notes: str | None = None
    deleg: str | None = None
    bot: str | None = None
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
    target: str | None = None
    before: str | None = None
    after: str | None = None
    agent: str | None = None
    notes: str | None = None


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
    email: str
    password: str = Field(min_length=8)
    name: str | None = None


class AuthLoginIn(BaseModel):
    email: str
    password: str


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


class MessageOut(BaseModel):
    message: str


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
