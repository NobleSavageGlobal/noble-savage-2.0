import os
from math import sqrt
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_EMBEDDING_MODEL = os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small")
OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings"
SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
SITE_NAME = os.getenv("OPENROUTER_SITE_NAME", "Noble Savage OS")


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_mag = sqrt(sum(a * a for a in left))
    right_mag = sqrt(sum(b * b for b in right))
    if left_mag == 0 or right_mag == 0:
        return 0.0
    return dot / (left_mag * right_mag)


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
    }


def embed_text(text: str) -> list[float]:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": OPENROUTER_EMBEDDING_MODEL,
        "input": text,
    }

    with httpx.Client(timeout=60) as client:
        res = client.post(OPENROUTER_EMBEDDING_URL, headers=_headers(), json=payload)

    if res.status_code >= 400:
        raise RuntimeError(f"OpenRouter embeddings error {res.status_code}: {res.text}")

    body: dict[str, Any] = res.json()
    data = body.get("data") or []
    if not data:
        raise RuntimeError("OpenRouter returned no embeddings")

    embedding = data[0].get("embedding")
    if not isinstance(embedding, list):
        raise RuntimeError("Invalid embedding response")

    return [float(value) for value in embedding]
