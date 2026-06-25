from pathlib import Path
import sys
import os

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.auth import hash_password
from app.store import create_user, get_user_by_email, seed_default_workstreams


if __name__ == "__main__":
    email = os.getenv("DEMO_EMAIL", "demo@noblesavage.local")
    password = os.getenv("DEMO_PASSWORD", "change-me-now")
    name = os.getenv("DEMO_NAME", "Demo User")

    existing = get_user_by_email(email)
    if existing:
        user_id = existing["id"]
    else:
        created = create_user(email=email, password_hash=hash_password(password), name=name)
        user_id = created["id"]

    inserted = seed_default_workstreams(user_id)
    print(f"Default workstreams inserted for {email}: {inserted}")
