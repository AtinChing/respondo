from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from bland_caller import router as bland_router
from vapi_caller import router as vapi_router
from video_agent import (
    AgentConfigurationError,
    VideoAnalysisError,
    VideoAnalysisResponse,
    VideoIssueAgent,
)

ALLOWED_SUFFIXES = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}
logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Respondo Backend",
    version="0.1.0",
    description="Video upload and incident analysis service for Respondo.",
)
app.include_router(bland_router, prefix="/api")
app.include_router(vapi_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_agent: VideoIssueAgent | None = None


def get_agent() -> VideoIssueAgent:
    global _agent
    if _agent is None:
        _agent = VideoIssueAgent.from_env()
    return _agent


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/analyze-video", response_model=VideoAnalysisResponse)
async def analyze_video(
    video: UploadFile | None = File(default=None),
    file: UploadFile | None = File(default=None),
    incident_id: str | None = Form(default=None),
    camera_id: str | None = Form(default=None),
) -> VideoAnalysisResponse:
    upload = video or file
    if upload is None:
        raise HTTPException(
            status_code=400,
            detail="Attach a video file using the `video` field.",
        )
    if not upload.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(upload.filename).suffix.lower() or ".mp4"
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. Allowed: "
                + ", ".join(sorted(ALLOWED_SUFFIXES))
            ),
        )

    temp_path: Path | None = None

    try:
        logger.info(
            "analysis.request_received filename=%s incident_id=%s camera_id=%s",
            upload.filename,
            incident_id or "-",
            camera_id or "-",
        )
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(upload.file, temp_file)
            temp_path = Path(temp_file.name)

        if temp_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        logger.info(
            "analysis.upload_saved filename=%s temp_path=%s size_bytes=%s",
            upload.filename,
            temp_path,
            temp_path.stat().st_size,
        )

        response = get_agent().analyze_video(
            temp_path,
            original_filename=upload.filename,
            incident_id=incident_id,
            camera_id=camera_id,
        )
        logger.info(
            "analysis.request_completed filename=%s flagged=%s incident_type=%s primary_department=%s severity=%s",
            upload.filename,
            response.flagged,
            response.incident_type,
            response.primary_department,
            response.severity,
        )
        return response
    except AgentConfigurationError as error:
        logger.error("analysis.configuration_error filename=%s error=%s", upload.filename, error)
        raise HTTPException(status_code=503, detail=str(error)) from error
    except VideoAnalysisError as error:
        logger.error("analysis.video_error filename=%s error=%s", upload.filename, error)
        raise HTTPException(status_code=422, detail=str(error)) from error
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("analysis.unexpected_error filename=%s", upload.filename)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected backend error: {error}",
        ) from error
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        for candidate in (video, file):
            if candidate is not None:
                await candidate.close()
