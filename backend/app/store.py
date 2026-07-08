import json
import os
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, Row

from .embeddings import cosine_similarity, embed_text

load_dotenv()

SQLITE_PATH = Path(__file__).resolve().parent.parent / "noble_savage.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+pysqlite:///{SQLITE_PATH}")


def _normalize_database_url(database_url: str) -> str:
    # Railway commonly provides postgres:// or postgresql:// without a driver.
    # Force psycopg3 so runtime matches installed dependency set.
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url

DEFAULT_WORKSTREAMS = [
    {
        "id": "ws_income",
        "name": "Income",
        "tier": "Tier 1",
        "owner": "Noble",
        "objective": "Stabilize and grow cash flow",
        "why": "Funds every other priority",
        "color": "#0f766e",
    },
    {
        "id": "ws_bba",
        "name": "BBA Pipeline",
        "tier": "Tier 1",
        "owner": "Noble",
        "objective": "Close paid clients",
        "why": "Primary business traction",
        "color": "#f59e0b",
    },
    {
        "id": "ws_legal",
        "name": "Trust and Legal",
        "tier": "Tier 1",
        "owner": "Noble",
        "objective": "Execute trust dependencies",
        "why": "Unblocks critical initiatives",
        "color": "#dc2626",
    },
    {
        "id": "ws_operations",
        "name": "Operations",
        "tier": "Tier 2",
        "owner": "Noble",
        "objective": "Keep systems reliable and repeatable",
        "why": "Sustains shipping velocity",
        "color": "#0369a1",
    },
    {
        "id": "ws_heritage",
        "name": "Heritage and Research",
        "tier": "Tier 2",
        "owner": "Noble",
        "objective": "Advance archive and petition artifacts",
        "why": "Long-horizon strategic value",
        "color": "#7c3aed",
    },
    {
        "id": "ws_family",
        "name": "Family and Life",
        "tier": "Tier 3",
        "owner": "Noble",
        "objective": "Protect health and household rhythm",
        "why": "Prevents burnout and drift",
        "color": "#047857",
    },
]


def _scope_ws_id(user_id: str, ws_id: str) -> str:
    prefix = f"u_{user_id[:8]}__"
    if ws_id.startswith(prefix):
        return ws_id
    return f"{prefix}{ws_id}"


def _make_engine() -> Engine:
    database_url = _normalize_database_url(DATABASE_URL)
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, future=True, pool_pre_ping=True, connect_args=connect_args)


engine = _make_engine()


def _table_has_column(table_name: str, column_name: str) -> bool:
    with engine.connect() as conn:
        if engine.dialect.name == "sqlite":
            rows = conn.execute(text(f"pragma table_info({table_name})")).all()
            return any(r._mapping["name"] == column_name for r in rows)

        rows = conn.execute(
            text(
                """
                select column_name
                from information_schema.columns
                where table_name = :table_name
                """
            ),
            {"table_name": table_name},
        ).all()
        return any(r._mapping["column_name"] == column_name for r in rows)


def _ensure_column(table_name: str, column_name: str, column_ddl: str) -> None:
    if _table_has_column(table_name, column_name):
        return
    with engine.begin() as conn:
        conn.execute(text(f"alter table {table_name} add column {column_name} {column_ddl}"))


def _to_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace(" ", "T"))
    return datetime.utcnow()


def _to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None

def _safe_json_loads(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _row_to_task(row: Row[Any]) -> dict[str, Any]:
    m = row._mapping
    return {
        "id": m["id"],
        "ws": m["ws"],
        "task": m["task"],
        "prio": m["prio"],
        "status": m["status"],
        "owner": m.get("owner"),
        "notes": m.get("notes"),
        "deleg": m.get("deleg"),
        "bot": m.get("bot"),
        "due": _to_date(m.get("due")),
        "created_at": _to_datetime(m["created_at"]),
        "updated_at": _to_datetime(m["updated_at"]),
    }


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                create table if not exists users (
                    id text primary key,
                    email text unique not null,
                    password_hash text not null,
                    name text,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists workstreams (
                    id text,
                    user_id text,
                    name text,
                    tier text,
                    owner text,
                    objective text,
                    why text,
                    color text,
                    primary key (id, user_id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists tasks (
                    id text primary key,
                    user_id text,
                    ws text,
                    task text not null,
                    prio text check (prio in ('P1','P2','P3')),
                    status text check (status in ('Backlog','This Week','In Progress','Blocked','Done')),
                    owner text,
                    notes text,
                    deleg text,
                    bot text,
                    due date,
                    created_at timestamp default CURRENT_TIMESTAMP,
                    updated_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists decisions (
                    id text primary key,
                    user_id text,
                    ts timestamp default CURRENT_TIMESTAMP,
                    prompt text,
                    recommendation text,
                    actual_action text,
                    status text check (status in ('DONE','IN MOTION','STILL BLUEPRINT')),
                    week_of date
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists signals (
                    id text primary key,
                    user_id text,
                    ts timestamp default CURRENT_TIMESTAMP,
                    kind text check (kind in ('accept','edit','dismiss','correct','gap')),
                    target text,
                    before text,
                    after text,
                    agent text,
                    notes text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists onboarding (
                    id text primary key,
                    user_id text,
                    step text,
                    complete boolean default false,
                    collected text,
                    updated_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists knowledge (
                    id text primary key,
                    user_id text,
                    title text not null,
                    content text not null,
                    source text,
                    tags text,
                    embedding text,
                    embedding_model text,
                    file_id text,
                    chunk_index integer,
                    chunk_total integer,
                    token_count integer default 0,
                    status text default 'indexed',
                    last_indexed_at timestamp,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )

    # Ensure tenant columns exist when upgrading older local databases.
    _ensure_column("workstreams", "user_id", "text")
    _ensure_column("tasks", "user_id", "text")
    _ensure_column("decisions", "user_id", "text")
    _ensure_column("signals", "user_id", "text")
    _ensure_column("onboarding", "user_id", "text")
    _ensure_column("knowledge", "user_id", "text")
    _ensure_column("knowledge", "embedding", "text")
    _ensure_column("knowledge", "embedding_model", "text")
    _ensure_column("knowledge", "file_id", "text")
    _ensure_column("knowledge", "chunk_index", "integer")
    _ensure_column("knowledge", "chunk_total", "integer")
    _ensure_column("knowledge", "token_count", "integer default 0")
    _ensure_column("knowledge", "status", "text default 'indexed'")
    _ensure_column("knowledge", "last_indexed_at", "timestamp")


def create_user(email: str, password_hash: str, name: str | None) -> dict[str, Any]:
    normalized_email = email.lower().strip()
    user_id = str(uuid.uuid4())
    with engine.begin() as conn:
        existing = conn.execute(
            text("select id from users where email = :email"),
            {"email": normalized_email},
        ).first()
        if existing:
            raise ValueError("Email already registered")

        conn.execute(
            text(
                """
                insert into users (id, email, password_hash, name)
                values (:id, :email, :password_hash, :name)
                """
            ),
            {
                "id": user_id,
                "email": normalized_email,
                "password_hash": password_hash,
                "name": name,
            },
        )
    seed_default_workstreams(user_id)
    return get_user_by_id(user_id)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("select id, email, name, password_hash from users where email = :email"),
            {"email": email.lower().strip()},
        ).first()
    if not row:
        return None
    return dict(row._mapping)


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("select id, email, name from users where id = :id"),
            {"id": user_id},
        ).first()
    return dict(row._mapping) if row else None


def seed_default_workstreams(user_id: str) -> int:
    inserted = 0
    with engine.begin() as conn:
        for ws in DEFAULT_WORKSTREAMS:
            scoped_id = _scope_ws_id(user_id, ws["id"])
            exists = conn.execute(
                text("select id from workstreams where id = :id and user_id = :user_id"),
                {"id": scoped_id, "user_id": user_id},
            ).first()
            if exists:
                continue
            payload = {**ws, "id": scoped_id, "user_id": user_id}
            conn.execute(
                text(
                    """
                    insert into workstreams (id, user_id, name, tier, owner, objective, why, color)
                    values (:id, :user_id, :name, :tier, :owner, :objective, :why, :color)
                    """
                ),
                payload,
            )
            inserted += 1
    return inserted


def list_workstreams(user_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select id, name, tier, owner, objective, why, color
                from workstreams
                where user_id = :user_id
                order by name asc
                """
            ),
            {"user_id": user_id},
        ).all()
    return [dict(r._mapping) for r in rows]


def upsert_workstream(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    scoped_id = _scope_ws_id(user_id, payload["id"])
    with engine.begin() as conn:
        row = conn.execute(
            text("select id from workstreams where id = :id and user_id = :user_id"),
            {"id": scoped_id, "user_id": user_id},
        ).first()

        full_payload = {**payload, "id": scoped_id, "user_id": user_id}
        if row:
            conn.execute(
                text(
                    """
                    update workstreams
                    set name = :name, tier = :tier, owner = :owner,
                        objective = :objective, why = :why, color = :color
                    where id = :id and user_id = :user_id
                    """
                ),
                full_payload,
            )
        else:
            conn.execute(
                text(
                    """
                    insert into workstreams (id, user_id, name, tier, owner, objective, why, color)
                    values (:id, :user_id, :name, :tier, :owner, :objective, :why, :color)
                    """
                ),
                full_payload,
            )

        fresh = conn.execute(
            text(
                """
                select id, name, tier, owner, objective, why, color
                from workstreams
                where id = :id and user_id = :user_id
                """
            ),
            {"id": scoped_id, "user_id": user_id},
        ).one()
    return dict(fresh._mapping)


def patch_workstream(user_id: str, ws_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                select id, name, tier, owner, objective, why, color
                from workstreams
                where id = :id and user_id = :user_id
                """
            ),
            {"id": ws_id, "user_id": user_id},
        ).first()
        if not row:
            return None

        merged = dict(row._mapping)
        merged.update({k: v for k, v in patch.items() if v is not None})

        conn.execute(
            text(
                """
                update workstreams
                set name = :name, tier = :tier, owner = :owner,
                    objective = :objective, why = :why, color = :color
                where id = :id and user_id = :user_id
                """
            ),
            {
                "id": ws_id,
                "user_id": user_id,
                "name": merged["name"],
                "tier": merged.get("tier"),
                "owner": merged.get("owner"),
                "objective": merged.get("objective"),
                "why": merged.get("why"),
                "color": merged.get("color"),
            },
        )

        fresh = conn.execute(
            text(
                """
                select id, name, tier, owner, objective, why, color
                from workstreams
                where id = :id and user_id = :user_id
                """
            ),
            {"id": ws_id, "user_id": user_id},
        ).one()
    return dict(fresh._mapping)


def list_tasks(user_id: str, status_filter: str | None = None) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        if status_filter:
            rows = conn.execute(
                text(
                    """
                    select * from tasks
                    where user_id = :user_id and status = :status
                    order by updated_at desc
                    """
                ),
                {"user_id": user_id, "status": status_filter},
            ).all()
        else:
            rows = conn.execute(
                text("select * from tasks where user_id = :user_id order by updated_at desc"),
                {"user_id": user_id},
            ).all()
    return [_row_to_task(r) for r in rows]


def _workstream_exists(user_id: str, ws_id: str) -> bool:
    with engine.connect() as conn:
        row = conn.execute(
            text("select id from workstreams where user_id = :user_id and id = :ws_id"),
            {"user_id": user_id, "ws_id": ws_id},
        ).first()
    return row is not None


def create_task(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not _workstream_exists(user_id, payload["ws"]):
        raise ValueError("Invalid workstream id for current user")

    task_id = str(uuid.uuid4())
    now = datetime.utcnow()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into tasks (id, user_id, ws, task, prio, status, owner, notes, deleg, bot, due, created_at, updated_at)
                values (:id, :user_id, :ws, :task, :prio, :status, :owner, :notes, :deleg, :bot, :due, :created_at, :updated_at)
                """
            ),
            {
                "id": task_id,
                "user_id": user_id,
                "ws": payload["ws"],
                "task": payload["task"],
                "prio": payload["prio"],
                "status": payload["status"],
                "owner": payload.get("owner"),
                "notes": payload.get("notes"),
                "deleg": payload.get("deleg"),
                "bot": payload.get("bot"),
                "due": payload.get("due"),
                "created_at": now,
                "updated_at": now,
            },
        )
        row = conn.execute(
            text("select * from tasks where id = :id and user_id = :user_id"),
            {"id": task_id, "user_id": user_id},
        ).one()
    return _row_to_task(row)


def patch_task(user_id: str, task_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    with engine.begin() as conn:
        row = conn.execute(
            text("select * from tasks where id = :id and user_id = :user_id"),
            {"id": task_id, "user_id": user_id},
        ).first()
        if not row:
            return None

        merged = dict(row._mapping)
        merged.update({k: v for k, v in patch.items() if v is not None})
        if "ws" in patch and patch.get("ws") is not None and not _workstream_exists(user_id, patch["ws"]):
            raise ValueError("Invalid workstream id for current user")
        merged["updated_at"] = datetime.utcnow()

        conn.execute(
            text(
                """
                update tasks
                set ws = :ws, task = :task, prio = :prio, status = :status,
                    owner = :owner, notes = :notes, deleg = :deleg,
                    bot = :bot, due = :due, updated_at = :updated_at
                where id = :id and user_id = :user_id
                """
            ),
            {
                "id": task_id,
                "user_id": user_id,
                "ws": merged["ws"],
                "task": merged["task"],
                "prio": merged["prio"],
                "status": merged["status"],
                "owner": merged.get("owner"),
                "notes": merged.get("notes"),
                "deleg": merged.get("deleg"),
                "bot": merged.get("bot"),
                "due": merged.get("due"),
                "updated_at": merged["updated_at"],
            },
        )
        fresh = conn.execute(
            text("select * from tasks where id = :id and user_id = :user_id"),
            {"id": task_id, "user_id": user_id},
        ).one()
    return _row_to_task(fresh)


def delete_task(user_id: str, task_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            text("delete from tasks where id = :id and user_id = :user_id"),
            {"id": task_id, "user_id": user_id},
        )
    return result.rowcount > 0


def create_signal(user_id: str, payload: dict[str, Any]) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into signals (id, user_id, kind, target, before, after, agent, notes)
                values (:id, :user_id, :kind, :target, :before, :after, :agent, :notes)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "kind": payload["kind"],
                "target": payload.get("target"),
                "before": payload.get("before"),
                "after": payload.get("after"),
                "agent": payload.get("agent"),
                "notes": payload.get("notes"),
            },
        )


def list_signals(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select id, kind, target, before, after, agent, notes, ts
                from signals
                where user_id = :user_id
                order by ts desc
                limit :limit
                """
            ),
            {"user_id": user_id, "limit": limit},
        ).all()
    return [
        {
            "id": r._mapping["id"],
            "kind": r._mapping["kind"],
            "target": r._mapping.get("target"),
            "before": r._mapping.get("before"),
            "after": r._mapping.get("after"),
            "agent": r._mapping.get("agent"),
            "notes": r._mapping.get("notes"),
            "ts": _to_datetime(r._mapping["ts"]),
        }
        for r in rows
    ]


def create_decision(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    record_id = str(uuid.uuid4())
    now = datetime.utcnow()
    recommendation = payload.get("recommendation")
    recommendation_json = None if recommendation is None else json.dumps(recommendation)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into decisions (id, user_id, ts, prompt, recommendation, actual_action, status, week_of)
                values (:id, :user_id, :ts, :prompt, :recommendation, :actual_action, :status, :week_of)
                """
            ),
            {
                "id": record_id,
                "user_id": user_id,
                "ts": now,
                "prompt": payload["prompt"],
                "recommendation": recommendation_json,
                "actual_action": payload.get("actual_action"),
                "status": payload["status"],
                "week_of": payload.get("week_of"),
            },
        )
        row = conn.execute(
            text(
                """
                select id, prompt, recommendation, actual_action, status, week_of, ts
                from decisions
                where id = :id and user_id = :user_id
                """
            ),
            {"id": record_id, "user_id": user_id},
        ).one()

    rec_value = row._mapping["recommendation"]
    return {
        "id": row._mapping["id"],
        "prompt": row._mapping["prompt"],
        "recommendation": json.loads(rec_value) if rec_value else None,
        "actual_action": row._mapping["actual_action"],
        "status": row._mapping["status"],
        "week_of": _to_date(row._mapping["week_of"]),
        "ts": _to_datetime(row._mapping["ts"]),
    }


def list_decisions(user_id: str, limit: int = 50, week_of: date | None = None) -> list[dict[str, Any]]:
    query = (
        """
        select id, prompt, recommendation, actual_action, status, week_of, ts
        from decisions
        where user_id = :user_id
        """
    )
    params: dict[str, Any] = {"user_id": user_id, "limit": limit}
    if week_of:
        query += " and week_of = :week_of"
        params["week_of"] = week_of
    query += " order by ts desc limit :limit"

    with engine.connect() as conn:
        rows = conn.execute(text(query), params).all()

    output: list[dict[str, Any]] = []
    for row in rows:
        rec_value = row._mapping["recommendation"]
        output.append(
            {
                "id": row._mapping["id"],
                "prompt": row._mapping["prompt"],
                "recommendation": json.loads(rec_value) if rec_value else None,
                "actual_action": row._mapping["actual_action"],
                "status": row._mapping["status"],
                "week_of": _to_date(row._mapping["week_of"]),
                "ts": _to_datetime(row._mapping["ts"]),
            }
        )
    return output


def get_decision_weekly_summary(user_id: str, week_of: date) -> dict[str, Any]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select status, count(*) as total
                from decisions
                where user_id = :user_id and week_of = :week_of
                group by status
                """
            ),
            {"user_id": user_id, "week_of": week_of},
        ).all()

    counts = {"DONE": 0, "IN MOTION": 0, "STILL BLUEPRINT": 0}
    for row in rows:
        status = row._mapping["status"]
        if status in counts:
            counts[status] = int(row._mapping["total"])

    total = counts["DONE"] + counts["IN MOTION"] + counts["STILL BLUEPRINT"]
    ratio = (counts["DONE"] / total) if total else 0.0
    return {
        "week_of": week_of,
        "done": counts["DONE"],
        "in_motion": counts["IN MOTION"],
        "still_blueprint": counts["STILL BLUEPRINT"],
        "total": total,
        "ship_to_plan_ratio": round(ratio, 4),
    }


def get_decision_trend(user_id: str, weeks: int = 8) -> list[dict[str, Any]]:
    weeks = max(1, min(52, weeks))
    start_week = date.today() - timedelta(days=(weeks - 1) * 7)

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select week_of, status, count(*) as total
                from decisions
                where user_id = :user_id
                  and week_of is not null
                  and week_of >= :start_week
                group by week_of, status
                order by week_of asc
                """
            ),
            {"user_id": user_id, "start_week": start_week},
        ).all()

    by_week: dict[date, dict[str, int]] = {}
    for row in rows:
        week = _to_date(row._mapping["week_of"])
        if not week:
            continue
        if week not in by_week:
            by_week[week] = {"DONE": 0, "IN MOTION": 0, "STILL BLUEPRINT": 0}
        status = row._mapping["status"]
        if status in by_week[week]:
            by_week[week][status] = int(row._mapping["total"])

    trend: list[dict[str, Any]] = []
    for week in sorted(by_week.keys()):
        done = by_week[week]["DONE"]
        in_motion = by_week[week]["IN MOTION"]
        still_blueprint = by_week[week]["STILL BLUEPRINT"]
        total = done + in_motion + still_blueprint
        ratio = (done / total) if total else 0.0
        trend.append(
            {
                "week_of": week,
                "done": done,
                "in_motion": in_motion,
                "still_blueprint": still_blueprint,
                "total": total,
                "ship_to_plan_ratio": round(ratio, 4),
            }
        )
    return trend


def get_onboarding(user_id: str) -> dict[str, Any]:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                select * from onboarding
                where user_id = :user_id
                order by updated_at desc
                limit 1
                """
            ),
            {"user_id": user_id},
        ).first()
    if not row:
        return {
            "step": "orient",
            "complete": False,
            "collected": {},
        }

    m = row._mapping
    return {
        "step": m["step"],
        "complete": bool(m["complete"]),
        "collected": json.loads(m["collected"] or "{}"),
    }


def save_onboarding(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                select id from onboarding
                where user_id = :user_id
                order by updated_at desc
                limit 1
                """
            ),
            {"user_id": user_id},
        ).first()
        now = datetime.utcnow()
        data = json.dumps(payload.get("collected", {}))
        if row:
            conn.execute(
                text(
                    """
                    update onboarding
                    set step = :step, complete = :complete, collected = :collected, updated_at = :updated_at
                    where id = :id
                    """
                ),
                {
                    "id": row._mapping["id"],
                    "step": payload["step"],
                    "complete": payload.get("complete", False),
                    "collected": data,
                    "updated_at": now,
                },
            )
        else:
            conn.execute(
                text(
                    """
                    insert into onboarding (id, user_id, step, complete, collected, updated_at)
                    values (:id, :user_id, :step, :complete, :collected, :updated_at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "step": payload["step"],
                    "complete": payload.get("complete", False),
                    "collected": data,
                    "updated_at": now,
                },
            )
    return get_onboarding(user_id)


def create_knowledge(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    record_id = str(uuid.uuid4())
    now = datetime.utcnow()
    embedding = payload.get("embedding")
    if embedding is None:
        embedding = embed_text(f"{payload['title']}\n{payload['content']}")
    status = payload.get("status") or "indexed"
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into knowledge (
                    id, user_id, title, content, source, tags, embedding, embedding_model,
                    file_id, chunk_index, chunk_total, token_count, status, last_indexed_at, created_at
                )
                values (
                    :id, :user_id, :title, :content, :source, :tags, :embedding, :embedding_model,
                    :file_id, :chunk_index, :chunk_total, :token_count, :status, :last_indexed_at, :created_at
                )
                """
            ),
            {
                "id": record_id,
                "user_id": user_id,
                "title": payload["title"],
                "content": payload["content"],
                "source": payload.get("source"),
                "tags": json.dumps(payload.get("tags") or []),
                "embedding": json.dumps(embedding),
                "embedding_model": payload.get("embedding_model") or os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
                "file_id": payload.get("file_id"),
                "chunk_index": payload.get("chunk_index"),
                "chunk_total": payload.get("chunk_total"),
                "token_count": int(payload.get("token_count") or 0),
                "status": status,
                "last_indexed_at": now if status == "indexed" else None,
                "created_at": now,
            },
        )
        row = conn.execute(
            text("select * from knowledge where id = :id and user_id = :user_id"),
            {"id": record_id, "user_id": user_id},
        ).one()
    m = row._mapping
    return {
        "id": m["id"],
        "title": m["title"],
        "content": m["content"],
        "source": m["source"],
        "tags": _safe_json_loads(m["tags"], []),
        "embedding": _safe_json_loads(m["embedding"], []),
        "embedding_model": m["embedding_model"],
        "file_id": m.get("file_id"),
        "chunk_index": m.get("chunk_index"),
        "chunk_total": m.get("chunk_total"),
        "token_count": int(m.get("token_count") or 0),
        "status": m.get("status") or "indexed",
        "last_indexed_at": _to_datetime(m["last_indexed_at"]) if m.get("last_indexed_at") else None,
        "created_at": _to_datetime(m["created_at"]),
    }


def list_knowledge(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select * from knowledge
                where user_id = :user_id
                order by created_at desc
                limit :limit
                """
            ),
            {"user_id": user_id, "limit": limit},
        ).all()
    output: list[dict[str, Any]] = []
    for row in rows:
        m = row._mapping
        output.append(
            {
                "id": m["id"],
                "title": m["title"],
                "content": m["content"],
                "source": m["source"],
                "tags": _safe_json_loads(m["tags"], []),
                "embedding": _safe_json_loads(m["embedding"], []),
                "embedding_model": m["embedding_model"],
                "file_id": m.get("file_id"),
                "chunk_index": m.get("chunk_index"),
                "chunk_total": m.get("chunk_total"),
                "token_count": int(m.get("token_count") or 0),
                "status": m.get("status") or "indexed",
                "last_indexed_at": _to_datetime(m["last_indexed_at"]) if m.get("last_indexed_at") else None,
                "created_at": _to_datetime(m["created_at"]),
            }
        )
    return output


def search_knowledge(
    user_id: str, query: str, limit: int = 8, file_ids: list[str] | None = None
) -> list[dict[str, Any]]:
    pool = list_knowledge(user_id, limit=200)
    if file_ids:
        allowed = {item for item in file_ids if item}
        pool = [item for item in pool if item.get("file_id") in allowed]
    if not pool:
        return []

    try:
        query_embedding = embed_text(query)
    except Exception:
        query_embedding = []

    scored: list[tuple[float, dict[str, Any]]] = []
    if query_embedding:
        for item in pool:
            score = cosine_similarity(query_embedding, item.get("embedding") or [])
            if score > 0:
                scored.append((score, item))

    if not scored:
        terms = [term.strip().lower() for term in query.split() if len(term.strip()) > 2]
        for item in pool:
            haystack = f"{item['title']}\n{item['content']}\n{' '.join(item['tags'])}".lower()
            score = sum(1 for term in terms if term in haystack)
            if score > 0:
                scored.append((float(score), item))

    scored.sort(key=lambda t: t[0], reverse=True)
    return [item for _, item in scored[:limit]] if scored else pool[: min(limit, len(pool))]


def reembed_knowledge_file(user_id: str, file_id: str) -> dict[str, Any]:
    entries = [item for item in list_knowledge(user_id, limit=500) if item.get("file_id") == file_id]
    if not entries:
        return {"updated": 0, "file_id": file_id}

    updated = 0
    for entry in entries:
        refreshed = update_knowledge_embedding(user_id, entry["id"])
        if refreshed:
            updated += 1
    return {"updated": updated, "file_id": file_id}


def update_knowledge_embedding(user_id: str, knowledge_id: str) -> dict[str, Any] | None:
    with engine.begin() as conn:
        row = conn.execute(
            text("select * from knowledge where id = :id and user_id = :user_id"),
            {"id": knowledge_id, "user_id": user_id},
        ).first()
        if not row:
            return None

        m = row._mapping
        embedding = embed_text(f"{m['title']}\n{m['content']}")
        conn.execute(
            text(
                """
                update knowledge
                set embedding = :embedding, embedding_model = :embedding_model, status = 'indexed', last_indexed_at = :last_indexed_at
                where id = :id and user_id = :user_id
                """
            ),
            {
                "id": knowledge_id,
                "user_id": user_id,
                "embedding": json.dumps(embedding),
                "embedding_model": os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
                "last_indexed_at": datetime.utcnow(),
            },
        )
        updated = conn.execute(
            text("select * from knowledge where id = :id and user_id = :user_id"),
            {"id": knowledge_id, "user_id": user_id},
        ).one()

    um = updated._mapping
    return {
        "id": um["id"],
        "title": um["title"],
        "content": um["content"],
        "source": um["source"],
        "tags": _safe_json_loads(um["tags"], []),
        "embedding": _safe_json_loads(um["embedding"], []),
        "embedding_model": um["embedding_model"],
        "file_id": um.get("file_id"),
        "chunk_index": um.get("chunk_index"),
        "chunk_total": um.get("chunk_total"),
        "token_count": int(um.get("token_count") or 0),
        "status": "indexed",
        "last_indexed_at": datetime.utcnow(),
        "created_at": _to_datetime(um["created_at"]),
    }
