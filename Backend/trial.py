import os
import requests

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "1bb9d3bd-4635-4e89-be56-5518d62265ae")
ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID", "bccd9118-06f6-4e2d-8706-ae5e668d6d56")
PHONE_NUMBER_ID = os.getenv("VAPI_PHONE_NUMBER_ID", "6b466729-7eb7-48ef-9df8-87211a417d4e")

VAPI_BASE_URL = "https://api.vapi.ai"


def make_outbound_call(phone_number: str) -> dict:
    """
    Initiates an outbound call to the given phone number using Vapi.

    Args:
        phone_number: The destination phone number in E.164 format (e.g. +15302208150)

    Returns:
        The API response as a dict containing call details (id, status, etc.)

    Raises:
        ValueError: If the phone number is empty or missing.
        requests.HTTPError: If the Vapi API returns an error response.
    """
    if not phone_number:
        raise ValueError("phone_number must not be empty.")

    url = f"{VAPI_BASE_URL}/call"

    headers = {
        "Authorization": f"Bearer {VAPI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "assistantId": ASSISTANT_ID,
        "phoneNumberId": PHONE_NUMBER_ID,
        "customer": {
            "number": phone_number,
        },
    }

    response = requests.post(url, json=payload, headers=headers)

    try:
        response.raise_for_status()
    except requests.HTTPError as e:
        print(f"[Vapi] HTTP error {response.status_code}: {response.text}")
        raise

    call_data = response.json()
    print(f"[Vapi] Call initiated successfully. Call ID: {call_data.get('id')} | Status: {call_data.get('status')}")
    return call_data