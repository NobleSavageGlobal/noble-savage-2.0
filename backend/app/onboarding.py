import re
from typing import Any

from .store import create_task, save_onboarding, upsert_workstream


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", value).strip().lower()
    cleaned = re.sub(r"\s+", "_", cleaned)
    return cleaned[:40] or "custom"


def _infer_tier(name: str) -> str:
    lowered = name.lower()
    if any(token in lowered for token in ["trust", "legal", "income", "client", "cash", "bba"]):
        return "Tier 1"
    if any(token in lowered for token in ["family", "health", "home"]):
        return "Tier 2"
    return "Tier 3"


def _split_items(answer: str) -> list[str]:
    chunks = re.split(r"[,\n]+", answer)
    return [c.strip() for c in chunks if c.strip()]


def _find_ws_for_chokepoint(chokepoint: str, workstreams: list[dict[str, Any]]) -> str:
    lowered = chokepoint.lower()
    for ws in workstreams:
        if ws["name"].lower() in lowered:
            return ws["id"]
    for ws in workstreams:
        ws_tokens = ws["name"].lower().split()
        if any(token in lowered for token in ws_tokens):
            return ws["id"]
    return workstreams[0]["id"] if workstreams else "ws_operations"


def _base_response(step: str, question: str, state: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    return {
        "step": step,
        "question": question,
        "note": note,
        "proposals": state.get("pending_proposals", []),
        "summary": state.get("summary", []),
        "complete": state.get("complete", False),
    }


def handle_turn(user_id: str, existing: dict[str, Any], answer: str | None) -> dict[str, Any]:
    step = existing.get("step") or "orient"
    data = existing.get("collected") or {}
    text = (answer or "").strip()

    if step == "orient":
        if not text:
            return _base_response(
                "orient",
                "I will ask one question at a time and build your board as we go. Ready to map your six workstreams?",
                data,
            )
        data["started"] = True
        saved = save_onboarding(user_id, {"step": "big_rocks", "complete": False, "collected": data})
        return _base_response(
            "big_rocks",
            "What are the six things your life is actually organized around right now? Use commas or new lines.",
            saved["collected"],
        )

    if step == "big_rocks":
        items = _split_items(text)
        if len(items) < 3:
            return _base_response(
                "big_rocks",
                "Give me at least three concrete workstreams so I can draft the board. What are they?",
                data,
                note="I need clearer inputs to avoid vague setup.",
            )

        proposals = []
        for i, name in enumerate(items[:6], start=1):
            ws_id = f"ws_{_slug(name)}"
            proposals.append(
                {
                    "type": "workstream",
                    "id": ws_id,
                    "name": name,
                    "tier": _infer_tier(name),
                    "owner": "Noble",
                    "objective": f"Ship high-leverage outcomes for {name}",
                    "why": f"{name} drives current portfolio progress",
                    "color": ["#0f766e", "#0369a1", "#7c3aed", "#b45309", "#be123c", "#334155"][i - 1],
                }
            )

        data["pending_proposals"] = proposals
        saved = save_onboarding(user_id, {"step": "confirm_workstreams", "complete": False, "collected": data})
        return _base_response(
            "confirm_workstreams",
            "I drafted your workstreams with inferred tiers. Confirm to write them now, or paste a revised list.",
            saved["collected"],
        )

    if step == "confirm_workstreams":
        if text.lower() in {"yes", "confirm", "approved", "y"}:
            approved = data.get("pending_proposals", [])
            workstreams = []
            for ws in approved:
                workstreams.append(
                    upsert_workstream(
                        user_id,
                        {
                            "id": ws["id"],
                            "name": ws["name"],
                            "tier": ws["tier"],
                            "owner": ws["owner"],
                            "objective": ws["objective"],
                            "why": ws["why"],
                            "color": ws["color"],
                        }
                    )
                )

            data["workstreams"] = workstreams
            data["pending_proposals"] = []
            data.setdefault("summary", []).append(f"{len(workstreams)} workstreams confirmed")
            saved = save_onboarding(user_id, {"step": "chokepoint", "complete": False, "collected": data})
            return _base_response(
                "chokepoint",
                "What is the single chokepoint that, if done this week, unblocks the most other work?",
                saved["collected"],
            )

        if text:
            saved = save_onboarding(user_id, {"step": "big_rocks", "complete": False, "collected": data})
            return _base_response(
                "big_rocks",
                "Received. Give your revised workstreams (comma or new-line list) and I will redraft.",
                saved["collected"],
                note="Revision mode enabled.",
            )

        return _base_response(
            "confirm_workstreams",
            "Confirm workstreams with 'yes', or paste revisions.",
            data,
        )

    if step == "chokepoint":
        if not text:
            return _base_response(
                "chokepoint",
                "Name the one chokepoint that unlocks the most progress.",
                data,
            )

        workstreams = data.get("workstreams", [])
        ws_id = _find_ws_for_chokepoint(text, workstreams)
        proposal = {
            "type": "task",
            "ws": ws_id,
            "task": text,
            "prio": "P1",
            "status": "This Week",
        }
        data["pending_proposals"] = [proposal]
        saved = save_onboarding(user_id, {"step": "confirm_chokepoint", "complete": False, "collected": data})
        return _base_response(
            "confirm_chokepoint",
            "I drafted this as your P1 chokepoint task. Confirm to pin it.",
            saved["collected"],
        )

    if step == "confirm_chokepoint":
        if text.lower() in {"yes", "confirm", "approved", "y"}:
            proposal = (data.get("pending_proposals") or [None])[0]
            if proposal:
                create_task(
                    user_id,
                    {
                        "ws": proposal["ws"],
                        "task": proposal["task"],
                        "prio": "P1",
                        "status": "This Week",
                        "owner": "Noble",
                        "notes": "Pinned during onboarding",
                        "deleg": None,
                        "bot": "OnboardBot",
                        "due": None,
                    }
                )
            data["pending_proposals"] = []
            data.setdefault("summary", []).append("P1 chokepoint pinned")
            saved = save_onboarding(user_id, {"step": "rhythm", "complete": False, "collected": data})
            return _base_response(
                "rhythm",
                "When should your morning brief arrive and how pushy should I be (low, medium, high)?",
                saved["collected"],
            )

        if text:
            saved = save_onboarding(user_id, {"step": "chokepoint", "complete": False, "collected": data})
            return _base_response(
                "chokepoint",
                "Got it. Give your revised chokepoint sentence and I will redraft the P1.",
                saved["collected"],
                note="Chokepoint revision mode.",
            )

        return _base_response(
            "confirm_chokepoint",
            "Confirm with 'yes' or send a revised chokepoint.",
            data,
        )

    if step == "rhythm":
        if not text:
            return _base_response(
                "rhythm",
                "Share preferred morning brief time and pushiness level.",
                data,
            )

        data["rhythm"] = {"preference": text}
        data.setdefault("summary", []).append(f"Cadence set: {text}")
        saved = save_onboarding(user_id, {"step": "done", "complete": True, "collected": data})
        return _base_response(
            "done",
            "Onboarding complete. Your board is populated, chokepoint is pinned, and cadence is set.",
            saved["collected"],
            note="You can continue refining from the board and chat.",
        )

    return _base_response(
        "done",
        "Onboarding is complete. Update tasks or ask for a weekly reset anytime.",
        data,
    )
