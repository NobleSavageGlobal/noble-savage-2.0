from pathlib import Path
import os
import sys
import uuid


def _prepare_isolated_db() -> Path:
    backend_root = Path(__file__).resolve().parents[1]
    db_path = backend_root / "noble_savage_e2e.db"
    if db_path.exists():
        db_path.unlink()
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{db_path}"
    return db_path


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client, email: str, password: str, name: str) -> str:
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload.get("access_token")
    return payload["access_token"]


def _turn(client, token: str, answer: str | None):
    res = client.post(
        "/api/onboarding/turn",
        json={"answer": answer},
        headers=_auth_header(token),
    )
    assert res.status_code == 200, res.text
    return res.json()


def main() -> None:
    _prepare_isolated_db()

    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from fastapi.testclient import TestClient
    from app.main import app

    run_id = uuid.uuid4().hex[:8]
    email_1 = f"e2e.primary.{run_id}@noblesavage.local"
    email_2 = f"e2e.secondary.{run_id}@noblesavage.local"
    password = "e2e-pass-123"

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json().get("message") == "ok"

        unauthorized = client.get("/api/tasks")
        assert unauthorized.status_code in (401, 403)

        token_1 = _register(client, email_1, password, "E2E Primary")
        token_2 = _register(client, email_2, password, "E2E Secondary")

        me_1 = client.get("/api/auth/me", headers=_auth_header(token_1))
        assert me_1.status_code == 200
        assert me_1.json()["email"] == email_1

        workstreams_1 = client.get("/api/workstreams", headers=_auth_header(token_1))
        assert workstreams_1.status_code == 200
        ws_list_1 = workstreams_1.json()
        assert len(ws_list_1) >= 6

        first = _turn(client, token_1, None)
        assert first["step"] == "orient"

        second = _turn(client, token_1, "yes")
        assert second["step"] == "big_rocks"

        third = _turn(
            client,
            token_1,
            "BBA Clients, Trust and Legal, Operations, Family, Heritage, Income",
        )
        assert third["step"] == "confirm_workstreams"
        assert len(third.get("proposals", [])) == 6

        fourth = _turn(client, token_1, "yes")
        assert fourth["step"] == "chokepoint"

        fifth = _turn(client, token_1, "Sign and notarize the trust this week")
        assert fifth["step"] == "confirm_chokepoint"
        assert fifth.get("proposals")

        sixth = _turn(client, token_1, "yes")
        assert sixth["step"] == "rhythm"

        seventh = _turn(client, token_1, "8:00am, high")
        assert seventh["step"] == "done"
        assert seventh["complete"] is True

        tasks_after_onboarding = client.get("/api/tasks", headers=_auth_header(token_1))
        assert tasks_after_onboarding.status_code == 200
        seeded_tasks = tasks_after_onboarding.json()
        assert any(t["prio"] == "P1" and t["status"] == "This Week" for t in seeded_tasks)

        created = client.post(
            "/api/tasks",
            json={
                "ws": ws_list_1[0]["id"],
                "task": "E2E websocket create",
                "prio": "P2",
                "status": "Backlog",
                "owner": "E2E Primary",
                "notes": None,
                "deleg": None,
                "bot": None,
                "due": None,
            },
            headers=_auth_header(token_1),
        )
        assert created.status_code == 200
        created_task = created.json()

        with client.websocket_connect(f"/ws/board?token={token_1}") as websocket:
            websocket.send_text("subscribe")
            assert websocket is not None

        patched = client.patch(
            f"/api/tasks/{created_task['id']}",
            json={"status": "In Progress"},
            headers=_auth_header(token_1),
        )
        assert patched.status_code == 200

        refreshed = client.get(f"/api/tasks?filter=In Progress", headers=_auth_header(token_1))
        assert refreshed.status_code == 200
        assert any(task["id"] == created_task["id"] and task["status"] == "In Progress" for task in refreshed.json())

        user_2_tasks = client.get("/api/tasks", headers=_auth_header(token_2))
        assert user_2_tasks.status_code == 200
        assert len(user_2_tasks.json()) == 0

        print("e2e_ok health auth onboarding websocket isolation")


if __name__ == "__main__":
    main()
