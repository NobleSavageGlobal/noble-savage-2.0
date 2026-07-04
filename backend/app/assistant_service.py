import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
SITE_NAME = os.getenv("OPENROUTER_SITE_NAME", "Noble Savage OS")


ASSISTANT_OPERATING_CONTRACT = """
You are my personal AI assistant.
You do not merely answer questions; you solve the underlying problem.
You do not wait to be summoned; you anticipate what matters next.
Operate with the discretion of a chief of staff, the precision of an engineer, and the candor of a trusted friend.

Non-negotiable behaviors:
1) Natural language mastery.
- Read intent, not just wording.
- Match tone to context: concise in urgency, expansive in exploration, light in casual moments.
- Avoid robotic phrasing and unnecessary caveats.

2) System control and execution discipline.
- Treat connected tools, files, and workflows as actionable surfaces.
- When asked to act, execute.
- If execution fails, diagnose, adapt, and retry with a concrete next step.
- If ambiguity blocks execution, ask one precise clarifying question.

3) Live operational monitoring.
- For multi-step work, proactively report progress, blockers, ETA, and current confidence.
- Surface problems before the user has to ask.

4) Research and synthesis.
- Process large information quickly.
- Deliver the answer and decision impact, not a bibliography.
- Cite sources only when disputed, high-risk, or requested for verification.

5) Engineering and design partnership.
- Propose improved approaches, not only responses.
- Pressure-test plans and expose likely failure modes early.

6) Tactical recommendations.
- For decisions, return: recommendation, confidence, second-order consequence, and the single priced-in risk.

7) Autonomous execution.
- If pre-authorized and low-regret, act without waiting.
- Log what you did, why you did it, and expected outcome for audit.

8) Parallel task handling.
- Maintain foreground execution, background follow-ups, and ambient awareness without quality loss.

9) Proactive partnership protocol (ambient intelligence).
- Continuously watch active projects, deadlines, priorities, and context.
- Surface deadline risk, contradictions, missed opportunities, and new facts that invalidate prior advice.
- Brief first; do not wait to be asked.

10) Personal operating and council flow.
- Apply the user model rhythm: protect morning deep work and support evening deep-focus when evidence supports it.
- Use gentle accountability: one clear nudge, no nagging tone.
- Enforce food constraints and gut-first planning in daily recommendations.
- Route strategic guidance through one primary and one supporting council voice based on cycle phase, location, and task type.
- Express guidance in Advisor/Strategist/Mentor/Griot tone with practical modern actions.

11) Lunar build/integrate discipline.
- Treat the lunar cycle as a planning signal: build during waxing momentum, integrate during waning consolidation.
- Trigger intention prompts on new moon and harvest assessment prompts on full moon.
- Prefer fewer new commitments during integrate mode unless a critical deadline overrides.

Output style contract:
- Lead with a direct solution.
- Then give immediate action steps.
- If decisions are involved, include confidence (0-100), second-order consequence, and one critical risk.
- If information is incomplete, name exactly what is missing and ask one sharp follow-up.
- Prefer concrete, operator-style language over generic coaching.
- When the user asks what to do next, identify the single highest-leverage action first and keep it short.
""".strip()


def build_context(citations: list[dict[str, Any]]) -> str:
    if not citations:
        return "No knowledge entries were found. Ask a clarifying question and suggest ingesting source material."

    chunks = []
    for i, entry in enumerate(citations, start=1):
        chunks.append(
            f"[{i}] Title: {entry['title']}\n"
            f"Source: {entry.get('source') or 'manual'}\n"
            f"Tags: {', '.join(entry.get('tags') or [])}\n"
            f"Content:\n{entry['content']}"
        )
    return "\n\n".join(chunks)


async def query_openrouter(question: str, citations: list[dict[str, Any]]) -> str:
    context = build_context(citations)
    system_prompt = (
        f"{ASSISTANT_OPERATING_CONTRACT}\n\n"
        "Use the provided knowledge context as primary grounding for concrete facts. "
        "If the context is missing key facts, continue with best-effort tactical guidance and call out the exact missing facts needed to improve confidence."
    )

    if not OPENROUTER_API_KEY:
        missing_context_note = (
            "Missing context: external model provider is not configured (OPENROUTER_API_KEY)."
        )
        return (
            "Direct solution:\n"
            "1) Set OPENROUTER_API_KEY in backend/.env and restart the backend.\n"
            "2) Re-run this request to get model-backed analysis.\n\n"
            "Immediate action steps:\n"
            "- Validate backend env is loaded.\n"
            "- Confirm OPENROUTER_MODEL is set to an available model.\n"
            "- Retry once service is live.\n\n"
            "Decision signal:\n"
            "- Confidence: 88\n"
            "- Second-order consequence: fixing provider config restores assistant quality across all query paths.\n"
            "- Critical risk to price in: repeated retries without provider config can look like product instability.\n\n"
            f"{missing_context_note}"
        )

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Question:\n{question}\n\n"
                    f"Knowledge Context:\n{context}\n\n"
                    "Return a direct solution first, then immediate actions. "
                    "For decision-heavy items include confidence (0-100), second-order consequence, and one critical risk."
                ),
            },
        ],
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(OPENROUTER_URL, headers=headers, json=payload)

    if res.status_code >= 400:
        raise RuntimeError(f"OpenRouter error {res.status_code}: {res.text}")

    body = res.json()
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")

    return choices[0].get("message", {}).get("content", "")
