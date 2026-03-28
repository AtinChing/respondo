# respondo
A supercharged self-improving security and emergency response and surveillance agent.

## Repo Shape

- `Backend/` is the Python FastAPI service.
- `Frontend/` is the React + Vite + TypeScript SPA.
- `Backend/security-manual-docs/` holds the manual corpus used for Railtracks + Chroma retrieval.

## Backend

The backend is centered around `Backend/main.py`, which exposes:

- `GET /health`
- `POST /api/analyze-video`

`Backend/video_agent.py` handles:

- OpenCV frame extraction from uploaded footage
- Gemini-based structured incident classification using the Google Gen AI SDK
- Vertex AI express-mode API-key auth via `GEMINI_API_KEY` for local development
- Chroma retrieval over security-manual documents using Railtracks vector-store utilities
- local session trace writes under `Backend/.railtracks/data/sessions/`

For local development, the backend now checks these env files without overriding
already-exported shell variables:

- `Backend/.env`
- repo-root `.env`
- `Frontend/.env.local`

If you're using a Vertex AI API key from Google Cloud console, keep using
`GEMINI_API_KEY` locally and the backend will pass it explicitly to the Google
client in Vertex AI mode.

Quick start:

```bash
cd Backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

## Frontend

The frontend app includes:

- an issue dashboard
- an issue-agent chat scaffold
- a classify-issue dialog
- a video analysis page that uploads footage to the FastAPI backend
