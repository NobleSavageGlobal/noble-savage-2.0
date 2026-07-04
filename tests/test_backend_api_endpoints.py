import importlib
from datetime import date

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("pydantic")

from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test_api.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{db_path}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")

    import backend.app.store as store_module
    import backend.app.main as main_module

    importlib.reload(store_module)
    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client


def _auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "StrongPass123!"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_task_create_delete_cycle(client: TestClient) -> None:
    headers = _auth_headers(client)

    workstreams = client.get("/api/workstreams", headers=headers)
    assert workstreams.status_code == 200
    ws_id = workstreams.json()[0]["id"]

    created = client.post(
        "/api/tasks",
        headers=headers,
        json={"ws": ws_id, "task": "Ship endpoint tests", "prio": "P1", "status": "This Week"},
    )
    assert created.status_code == 200, created.text
    task_id = created.json()["id"]

    deleted = client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert deleted.status_code == 200

    deleted_again = client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert deleted_again.status_code == 404


def test_decision_weekly_summary(client: TestClient) -> None:
    headers = _auth_headers(client)
    week = date(2026, 7, 6).isoformat()

    payloads = [
        {"prompt": "Decision A", "status": "DONE", "week_of": week},
        {"prompt": "Decision B", "status": "IN MOTION", "week_of": week},
        {"prompt": "Decision C", "status": "STILL BLUEPRINT", "week_of": week},
        {"prompt": "Decision D", "status": "DONE", "week_of": week},
    ]
    for payload in payloads:
        response = client.post("/api/decisions", headers=headers, json=payload)
        assert response.status_code == 200, response.text

    decision_list = client.get(f"/api/decisions?week_of={week}", headers=headers)
    assert decision_list.status_code == 200, decision_list.text
    assert len(decision_list.json()) == 4

    summary = client.get(f"/api/decisions/weekly-summary?week_of={week}", headers=headers)
    assert summary.status_code == 200, summary.text
    body = summary.json()
    assert body["done"] == 2
    assert body["in_motion"] == 1
    assert body["still_blueprint"] == 1
    assert body["total"] == 4
    assert body["ship_to_plan_ratio"] == 0.5

    trend = client.get("/api/decisions/trend?weeks=52", headers=headers)
    assert trend.status_code == 200, trend.text
    trend_points = trend.json()
    assert len(trend_points) >= 1
    assert any(point["week_of"] == week for point in trend_points)


def test_signal_round_trip(client: TestClient) -> None:
    headers = _auth_headers(client)

    created = client.post(
        "/api/signals",
        headers=headers,
        json={"kind": "accept", "target": "task_123", "agent": "assistant"},
    )
    assert created.status_code == 200, created.text

    listed = client.get("/api/signals?limit=10", headers=headers)
    assert listed.status_code == 200, listed.text
    data = listed.json()
    assert len(data) >= 1
    assert data[0]["kind"] == "accept"
