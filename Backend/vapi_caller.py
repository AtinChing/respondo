"""
Outbound calls via Vapi. Set in Backend/.env:

  VAPI_API_KEY
  VAPI_ASSISTANT_ID
  VAPI_PHONE_NUMBER_ID

Webhook URL to configure in Vapi (Server URL for end-of-call events):
  {your-public-origin}/api/vapi/webhook

See: https://docs.vapi.ai/calls/outbound-calling
Server payload shape: https://docs.vapi.ai/server-url/events
"""

import os
import re

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(tags=["vapi"])

VAPI_BASE = "https://api.vapi.ai"
RETRY_REASONS = frozenset({"customer-did-not-answer", "customer-busy", "pipeline-error"})


def _require_vapi_env() -> tuple[str, str, str]:
    api_key = os.environ.get("VAPI_API_KEY", "").strip()
    assistant_id = os.environ.get("VAPI_ASSISTANT_ID", "").strip()
    phone_number_id = os.environ.get("VAPI_PHONE_NUMBER_ID", "").strip()
    if not api_key or not assistant_id or not phone_number_id:
        raise HTTPException(
            status_code=503,
            detail=(
                "Vapi is not configured: set VAPI_API_KEY, VAPI_ASSISTANT_ID, "
                "and VAPI_PHONE_NUMBER_ID in the environment."
            ),
        )
    return api_key, assistant_id, phone_number_id


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _normalize_e164(number: str) -> str:
    """Strip whitespace; Vapi expects E.164 (e.g. +14155552671)."""
    n = re.sub(r"\s+", "", (number or "").strip())
    return n


async def _fire_call(
    phone_number: str,
    metadata: dict | None = None,
) -> dict:
    api_key, assistant_id, phone_number_id = _require_vapi_env()
    dest = _normalize_e164(phone_number)
    if not dest or not dest.startswith("+"):
        raise HTTPException(
            status_code=400,
            detail="Each phone number must be in E.164 format starting with + (e.g. +14155551234).",
        )

    # REST API expects top-level assistantId (nested assistant.assistantId returns 400).
    payload: dict = {
        "assistantId": assistant_id,
        "phoneNumberId": phone_number_id,
        "customer": {"number": dest},
    }
    if metadata:
        payload["metadata"] = metadata

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{VAPI_BASE}/call",
            headers=_headers(api_key),
            json=payload,
        )
    if not r.is_success:
        raise HTTPException(
            status_code=502,
            detail=f"Vapi error: {r.text}",
        )
    return r.json()


class CallPhoneNumbersRequest(BaseModel):
    phone_numbers: list[str] = Field(
        ...,
        description='E.164 numbers, e.g. ["+14155551234", "+14155555678"]',
    )


@router.post("/call-phone-numbers")
async def call_phone_numbers(body: CallPhoneNumbersRequest):
    """Start a sequential outbound session: first number now; webhook dials the rest on no-answer."""
    if not body.phone_numbers:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one phone number.",
        )

    numbers = [_normalize_e164(n) for n in body.phone_numbers]
    bad = [n for n in numbers if not n or not n.startswith("+")]
    if bad:
        raise HTTPException(
            status_code=400,
            detail="Every phone number must be E.164 with a leading + (e.g. +14155551234).",
        )

    first = numbers[0]
    rest = numbers[1:]

    call = await _fire_call(
        phone_number=first,
        metadata={"remaining": rest} if rest else None,
    )

    return {
        "status": "initiated",
        "calling": first,
        "remaining": rest,
        "vapi_call_id": call.get("id"),
    }


def _unwrap_server_message(body: dict) -> tuple[dict | None, str, dict]:
    """
    Vapi Server URL events use { "message": { "type", "call", "endedReason", ... } }.
    See https://docs.vapi.ai/server-url/events
    """
    message = body.get("message")
    if isinstance(message, dict):
        call = message.get("call") or {}
        ended_reason = (
            message.get("endedReason")
            or call.get("endedReason")
            or ""
        )
        return message, str(ended_reason), call

    # Rare flat shape (e.g. older proxies)
    call = body.get("call") or {}
    ended_reason = body.get("endedReason") or call.get("endedReason") or ""
    return None, str(ended_reason), call


@router.post("/vapi/webhook")
async def vapi_webhook(request: Request):
    """
    Vapi POSTs here on events. On end-of-call-report, if the call ended in a
    retry reason and more numbers remain, the next outbound call is started.
    """
    body = await request.json()
    if not isinstance(body, dict):
        return {"ok": True}

    message, ended_reason, call = _unwrap_server_message(body)
    msg_type = (message.get("type") if message else None) or body.get("type")

    if msg_type != "end-of-call-report":
        return {"ok": True}

    # Prefer top-level call.metadata (set on create); fall back to assistantOverrides for older calls.
    metadata = call.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    if not metadata.get("remaining"):
        nested = (call.get("assistantOverrides") or {}).get("metadata") or {}
        if isinstance(nested, dict) and nested.get("remaining") is not None:
            metadata = nested

    remaining = metadata.get("remaining") or []

    if not isinstance(remaining, list):
        remaining = []

    if ended_reason in RETRY_REASONS and remaining:
        next_number = remaining[0]
        still_left = remaining[1:]

        await _fire_call(
            phone_number=next_number,
            metadata={"remaining": still_left} if still_left else None,
        )
        return {"action": "retry", "calling": next_number, "remaining": still_left}

    return {"action": "completed", "ended_reason": ended_reason}
