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
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    context = build_context(citations)
    system_prompt = (
        "You are Noble Savage assistant. Answer using only the provided knowledge context. "
        "If information is missing, explicitly say what is missing and ask one sharp follow-up. "
        "Be concise and decisive."
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
                    "Return practical next actions and reference facts from context."
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
