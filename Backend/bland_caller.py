"""
Single outbound call via Bland.ai. Set in Backend/.env:

  BLAND_API_KEY

Optional:
  BLAND_VOICE  (defaults to project voice UUID)
  BLAND_TASK   (agent instructions; required by API — overrides built-in default)

POST https://api.bland.ai/v1/calls — see Bland API docs.
"""

import os
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["bland"])

BLAND_CALLS_URL = "https://api.bland.ai/v1/calls"

DEFAULT_VOICE = "e5c47f42-1338-40d2-89d5-06787100758f"

DEFAULT_TASK = (
    "You are placing a short outbound call. Greet the person professionally, "
    "ask if now is a good time to talk, and if they agree, briefly explain you "
    "are reaching out from the team and offer to help with any questions. "
    "Keep the conversation concise and polite."
)


def _require_bland_key() -> str:
    key = os.environ.get("BLAND_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Bland.ai is not configured: set BLAND_API_KEY in the environment.",
        )
    return key


def _normalize_e164(number: str) -> str:
    n = re.sub(r"\s+", "", (number or "").strip())
    return n


def _resolve_task(explicit: str | None) -> str:
    if explicit is not None and explicit.strip():
        return explicit.strip()
    env = os.environ.get("BLAND_TASK", "").strip()
    return env or DEFAULT_TASK


def _bland_payload(phone_number: str, task: str) -> dict:
    voice = os.environ.get("BLAND_VOICE", "").strip() or DEFAULT_VOICE
    return {
        "phone_number": phone_number,
        "task": task,
        "voice": voice,
        "wait_for_greeting": False,
        "record": True,
        "answered_by_enabled": True,
        "noise_cancellation": False,
        "interruption_threshold": 500,
        "block_interruptions": False,
        "max_duration": 12,
        "model": "base",
        "language": "babel-en",
        "background_track": "none",
        "endpoint": "https://api.bland.ai",
        "voicemail_action": "hangup",
    }


class BlandOutboundRequest(BaseModel):
    phone_number: str = Field(
        ...,
        description="E.164 number, e.g. +14155551234",
    )
    task: str | None = Field(
        default=None,
        description="Instructions for the agent. If omitted, uses BLAND_TASK or a default.",
    )


@router.post("/bland/outbound-call")
async def bland_outbound_call(body: BlandOutboundRequest):
    """Start exactly one outbound call via Bland.ai."""
    api_key = _require_bland_key()
    dest = _normalize_e164(body.phone_number)
    if not dest or not dest.startswith("+"):
        raise HTTPException(
            status_code=400,
            detail="phone_number must be E.164 with a leading + (e.g. +14155551234).",
        )

    payload = _bland_payload(dest, _resolve_task(body.task))

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            BLAND_CALLS_URL,
            headers={"Authorization": api_key},
            json=payload,
        )

    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text}

    if not r.is_success:
        detail = data if isinstance(data, dict) else str(data)
        raise HTTPException(status_code=502, detail=f"Bland.ai error: {detail}")

    return data
