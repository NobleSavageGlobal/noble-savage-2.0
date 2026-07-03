from pathlib import Path
import os
import sys
import uuid


def _prepare_isolated_db() -> Path:
    backend_root = Path(__file__).resolve().parents[1]
    db_path = backend_root / "noble_savage_compendium_smoke.db"
    if db_path.exists():
        db_path.unlink()
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{db_path}"
    return db_path


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    _prepare_isolated_db()

    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from fastapi.testclient import TestClient
    from app.main import app

    run_id = uuid.uuid4().hex[:8]
    email = f"compendium.smoke.{run_id}@noblesavage.local"
    password = "compendium-pass-123"

    with TestClient(app) as client:
        reg = client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "name": "Compendium Smoke"},
        )
        assert reg.status_code == 200, reg.text
        token = reg.json()["access_token"]
        headers = _auth_header(token)

        scholars = client.get("/comp/scholars", headers=headers)
        assert scholars.status_code == 200, scholars.text
        scholar_rows = scholars.json()
        assert len(scholar_rows) >= 10

        one = scholar_rows[0]["id"]
        detail = client.get(f"/comp/scholar/{one}", headers=headers)
        assert detail.status_code == 200

        convened = client.get("/comp/council/convene?moment=morning_briefing", headers=headers)
        assert convened.status_code == 200
        assert len(convened.json().get("convened", [])) >= 1

        plants = client.get("/comp/plants", headers=headers)
        assert plants.status_code == 200
        plant_rows = plants.json()
        assert len(plant_rows) >= 3

        plant_id = plant_rows[0]["id"]
        plant_detail = client.get(f"/comp/plant/{plant_id}", headers=headers)
        assert plant_detail.status_code == 200

        garden = client.post(
            "/comp/garden/design",
            json={
                "name": "Smoke Florida Garden",
                "location": "Florida",
                "tradition_weights": {"egyptian": 0.3, "moorish": 0.3, "sephardic": 0.2, "indigenous": 0.2},
                "square_feet": 200,
                "usda_zone": "10a",
                "sun_exposure": "full",
                "goals": ["medicinal", "kitchen"],
            },
            headers=headers,
        )
        assert garden.status_code == 200, garden.text

        texts = client.get("/comp/texts", headers=headers)
        assert texts.status_code == 200
        assert len(texts.json()) >= 1

        query = client.post("/comp/query", json={"query": "regimen and observation"}, headers=headers)
        assert query.status_code == 200
        assert query.json().get("confidence_tier") in {"low", "medium", "high"}

        briefing = client.post(
            "/comp/briefing/digest",
            json={"moment": "morning_briefing", "focus": "trust execution"},
            headers=headers,
        )
        assert briefing.status_code == 200, briefing.text
        assert "digest" in briefing.json()

        meal = client.post(
            "/comp/meals/context",
            json={"meal_name": "herbal tea", "ingredients": ["ginger", "turmeric"], "notes": "smoke"},
            headers=headers,
        )
        assert meal.status_code == 200, meal.text
        assert isinstance(meal.json().get("safety_flags"), list)

        print("compendium_smoke_ok")


if __name__ == "__main__":
    main()
