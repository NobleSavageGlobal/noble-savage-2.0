from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.onboarding import handle_turn
from app.store import create_task, create_user, get_onboarding, get_user_by_email, list_tasks


def main() -> None:
    email = "integration@noblesavage.local"
    password = "integration-pass-123"

    existing = get_user_by_email(email)
    if existing:
        user_id = existing["id"]
    else:
        user = create_user(email=email, password_hash=hash_password(password), name="Integration User")
        user_id = user["id"]

    hashed = hash_password(password)
    assert verify_password(password, hashed)

    token = create_access_token(user_id, email)
    payload = decode_access_token(token)
    assert payload["sub"] == user_id

    create_task(
        user_id,
        {
            "ws": f"u_{user_id[:8]}__ws_income",
            "task": "Auth wiring smoke task",
            "prio": "P2",
            "status": "Backlog",
            "owner": "Integration User",
            "notes": None,
            "deleg": None,
            "bot": None,
            "due": None,
        },
    )

    state = get_onboarding(user_id)
    out = handle_turn(user_id, state, None)
    print("onboarding_step", out["step"])
    print("task_count", len(list_tasks(user_id)))
    print("token_sub", payload["sub"])


if __name__ == "__main__":
    main()
