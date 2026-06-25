from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.auth import hash_password
from app.store import (
    create_knowledge,
    create_user,
    get_user_by_email,
    init_db,
    list_knowledge,
    update_knowledge_embedding,
)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    email = "demo@noblesavage.local"

    init_db()

    user = get_user_by_email(email)
    if not user:
        user = create_user(email=email, password_hash=hash_password("change-me-now"), name="Demo User")

    entries = [
        {
            "title": "Noble Savage AGENTS Contract",
            "content": read_text(repo_root / "AGENTS.md")[:50000],
            "source": "AGENTS.md",
            "tags": ["agents", "operating-system", "onboarding", "guardrails"],
        },
        {
            "title": "Repository README",
            "content": read_text(repo_root / "README.md")[:25000],
            "source": "README.md",
            "tags": ["setup", "architecture", "api"],
        },
    ]

    inserted = 0
    for entry in entries:
        if not entry["content"].strip():
            continue
        create_knowledge(user["id"], entry)
        inserted += 1

    for existing in list_knowledge(user["id"], limit=200):
        if not existing.get("embedding"):
            update_knowledge_embedding(user["id"], existing["id"])

    print(f"Knowledge entries inserted for {email}: {inserted}")


if __name__ == "__main__":
    main()
