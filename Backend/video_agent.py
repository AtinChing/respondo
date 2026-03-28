from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, Field, ValidationError
from railtracks.vector_stores.chroma import ChromaVectorStore
from railtracks.vector_stores.chunking.base_chunker import Chunk
from railtracks.vector_stores.chunking.fixed_token_chunker import FixedTokenChunker
from railtracks.vector_stores.chunking.media_parser import MediaParser

def _load_runtime_env() -> None:
    backend_dir = Path(__file__).resolve().parent
    repo_dir = backend_dir.parent
    for env_file in (
        repo_dir / ".env",
        repo_dir / "Frontend" / ".env.local",
        backend_dir / ".env",
    ):
        if env_file.is_file():
            load_dotenv(env_file, override=False)


_load_runtime_env()

SUPPORTED_MANUAL_EXTENSIONS = (".txt", ".md", ".pdf", ".jsonl")
INCIDENT_TYPES = (
    "FIRE",
    "THEFT_OR_ROBBERY",
    "VIOLENCE_OR_ASSAULT",
    "MEDICAL_EMERGENCY",
    "SUSPICIOUS_BEHAVIOR",
    "PROPERTY_DAMAGE",
    "UNAUTHORIZED_ACCESS",
    "NON_ACTIONABLE",
)


class AgentConfigurationError(RuntimeError):
    pass


class VideoAnalysisError(RuntimeError):
    pass


class FrameSample(BaseModel):
    timestamp_seconds: float
    frame_index: int


class ManualMatch(BaseModel):
    id: str
    distance: float
    content: str
    document: str | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class ManualIndexResult(BaseModel):
    collection_name: str
    docs_directory: str
    docs_indexed: int
    chunks_indexed: int
    reindexed: bool
    manifest_path: str
    supported_extensions: list[str]


class IncidentClassification(BaseModel):
    flagged: bool
    incident_type: Literal[
        "FIRE",
        "THEFT_OR_ROBBERY",
        "VIOLENCE_OR_ASSAULT",
        "MEDICAL_EMERGENCY",
        "SUSPICIOUS_BEHAVIOR",
        "PROPERTY_DAMAGE",
        "UNAUTHORIZED_ACCESS",
        "NON_ACTIONABLE",
    ]
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    summary: str
    description: str
    primary_department: str
    secondary_departments: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    reasoning: str
    confidence: float = Field(ge=0, le=1)
    manual_search_query: str | None = None


class VideoAnalysisResponse(BaseModel):
    video_filename: str | None = None
    incident_id: str | None = None
    camera_id: str | None = None
    analysis_mode: Literal["gemini"]
    flagged: bool
    incident_type: str
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    summary: str
    description: str
    reasoning: str
    confidence: float
    primary_department: str
    secondary_departments: list[str]
    recommended_actions: list[str]
    manual_search_query: str | None = None
    manual_matches: list[ManualMatch] = Field(default_factory=list)
    manual_index: ManualIndexResult | None = None
    sampled_frames: list[FrameSample] = Field(default_factory=list)
    analyzed_at: str


class VideoIssueAgent:
    def __init__(
        self,
        *,
        use_vertexai: bool,
        api_key: str,
        model: str,
        embedding_model: str,
        project: str | None,
        location: str | None,
        manual_docs_dir: Path,
        chroma_path: Path,
        collection_name: str,
        frame_sample_count: int,
        chunk_size: int,
        chunk_overlap: int,
        trace_directory: Path,
    ) -> None:
        self.use_vertexai = use_vertexai
        self.api_key = api_key
        self.model = model
        self.embedding_model = embedding_model
        self.project = project
        self.location = location
        self.manual_docs_dir = manual_docs_dir
        self.chroma_path = chroma_path
        self.collection_name = collection_name
        self.frame_sample_count = frame_sample_count
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.trace_directory = trace_directory
        self.client = self._build_client()

        self.manual_docs_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_path.mkdir(parents=True, exist_ok=True)
        self.trace_directory.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_env(cls) -> "VideoIssueAgent":
        return cls(
            use_vertexai=_read_boolean_env(
                "GEMINI_USE_VERTEXAI",
                fallback=_read_boolean_env("GOOGLE_GENAI_USE_VERTEXAI", fallback=True),
            ),
            api_key=_read_api_key(),
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip(),
            embedding_model=os.getenv(
                "GEMINI_EMBEDDING_MODEL",
                "gemini-embedding-001",
            ).strip(),
            project=_read_optional_env("GOOGLE_CLOUD_PROJECT"),
            location=_read_optional_env("GOOGLE_CLOUD_LOCATION"),
            manual_docs_dir=Path(
                os.getenv("MANUAL_DOCS_DIR", "./security-manual-docs")
            ).resolve(),
            chroma_path=Path(
                os.getenv("CHROMA_PATH", "./chroma-data/security-manuals")
            ).resolve(),
            collection_name=os.getenv("MANUAL_COLLECTION", "security_manual").strip(),
            frame_sample_count=_read_positive_int("FRAME_SAMPLE_COUNT", 6),
            chunk_size=_read_positive_int("MANUAL_CHUNK_SIZE", 400),
            chunk_overlap=_read_non_negative_int("MANUAL_CHUNK_OVERLAP", 80),
            trace_directory=Path(
                os.getenv("RAILTRACKS_SESSION_DIR", "./.railtracks/data/sessions")
            ).resolve(),
        )

    def _build_client(self) -> genai.Client:
        if self.use_vertexai:
            client_kwargs: dict[str, Any] = {
                "vertexai": True,
                "http_options": genai_types.HttpOptions(api_version="v1"),
            }
            if self.api_key:
                client_kwargs["api_key"] = self.api_key
            if self.project:
                client_kwargs["project"] = self.project
            if self.location:
                client_kwargs["location"] = self.location

            if not self.api_key and not (self.project and self.location):
                raise AgentConfigurationError(
                    "Vertex AI mode requires either GEMINI_API_KEY/GOOGLE_API_KEY "
                    "for express mode or GOOGLE_CLOUD_PROJECT plus "
                    "GOOGLE_CLOUD_LOCATION for standard Vertex AI."
                )
            return genai.Client(**client_kwargs)

        if not self.api_key:
            raise AgentConfigurationError(
                "Missing GEMINI_API_KEY (or GOOGLE_API_KEY) for Gemini API access."
            )

        return genai.Client(
            api_key=self.api_key,
            http_options=genai_types.HttpOptions(api_version="v1alpha"),
        )

    def analyze_video(
        self,
        video_path: Path,
        *,
        original_filename: str | None = None,
        incident_id: str | None = None,
        camera_id: str | None = None,
    ) -> VideoAnalysisResponse:
        frames, frame_parts = self._extract_frames(video_path)
        if not frames or not frame_parts:
            raise VideoAnalysisError(f"Could not extract usable frames from {video_path.name}.")

        classification = self._classify_frames(
            frame_parts,
            original_filename=original_filename or video_path.name,
            incident_id=incident_id,
            camera_id=camera_id,
        )

        if not classification.flagged:
            classification.incident_type = "NON_ACTIONABLE"
            classification.manual_search_query = None
            if classification.primary_department.lower() == "none":
                classification.primary_department = "Monitoring Only"

        manual_index: ManualIndexResult | None = None
        manual_matches: list[ManualMatch] = []
        if classification.flagged and classification.manual_search_query:
            manual_index = self.index_manuals()
            if manual_index.docs_indexed > 0:
                manual_matches = self.search_manuals(classification.manual_search_query)

        response = VideoAnalysisResponse(
            video_filename=original_filename or video_path.name,
            incident_id=incident_id,
            camera_id=camera_id,
            analysis_mode="gemini",
            flagged=classification.flagged,
            incident_type=classification.incident_type,
            severity=classification.severity,
            summary=classification.summary,
            description=classification.description,
            reasoning=classification.reasoning,
            confidence=classification.confidence,
            primary_department=classification.primary_department,
            secondary_departments=classification.secondary_departments,
            recommended_actions=classification.recommended_actions,
            manual_search_query=classification.manual_search_query,
            manual_matches=manual_matches,
            manual_index=manual_index,
            sampled_frames=frames,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )
        self._write_trace(response)
        return response

    def index_manuals(self, *, reset: bool = False) -> ManualIndexResult:
        if self.chunk_overlap >= self.chunk_size:
            raise AgentConfigurationError(
                "MANUAL_CHUNK_OVERLAP must be smaller than MANUAL_CHUNK_SIZE."
            )

        manifest_path = self._manifest_path()
        documents = self._list_manual_documents()
        signature = self._compute_signature(documents)
        existing_manifest = self._read_manifest(manifest_path)

        if (
            not reset
            and existing_manifest
            and existing_manifest.get("signature") == signature
        ):
            return ManualIndexResult(
                collection_name=existing_manifest["collection_name"],
                docs_directory=existing_manifest["docs_directory"],
                docs_indexed=existing_manifest["docs_indexed"],
                chunks_indexed=existing_manifest["chunks_indexed"],
                reindexed=False,
                manifest_path=existing_manifest["manifest_path"],
                supported_extensions=existing_manifest["supported_extensions"],
            )

        chunker = FixedTokenChunker(
            chunk_size=self.chunk_size,
            overlap=self.chunk_overlap,
        )
        document_store, _query_store = self._create_vector_stores()
        existing_items = document_store.fetch()
        if existing_items:
            document_store.delete([item.id for item in existing_items])

        chunks: list[Chunk] = []
        docs_indexed = 0
        for document_path in documents:
            relative_path = document_path.relative_to(self.manual_docs_dir)
            doc_chunks = self._build_chunks_for_document(
                document_path,
                relative_path,
                chunker,
            )
            if not doc_chunks:
                continue

            chunks.extend(doc_chunks)
            docs_indexed += 1

        if chunks:
            document_store.upsert(chunks)

        manifest = {
            "signature": signature,
            "collection_name": self.collection_name,
            "docs_directory": str(self.manual_docs_dir),
            "docs_indexed": docs_indexed,
            "chunks_indexed": len(chunks),
            "manifest_path": str(manifest_path),
            "supported_extensions": list(SUPPORTED_MANUAL_EXTENSIONS),
        }
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        return ManualIndexResult(
            collection_name=self.collection_name,
            docs_directory=str(self.manual_docs_dir),
            docs_indexed=docs_indexed,
            chunks_indexed=len(chunks),
            reindexed=True,
            manifest_path=str(manifest_path),
            supported_extensions=list(SUPPORTED_MANUAL_EXTENSIONS),
        )

    def search_manuals(self, query: str, *, top_k: int = 5) -> list[ManualMatch]:
        if not query.strip():
            return []

        _document_store, query_store = self._create_vector_stores()
        results = query_store.search(query, top_k=top_k)
        return [
            ManualMatch(
                id=result.id,
                distance=result.distance,
                content=result.content,
                document=result.document,
                metadata=_sanitize_metadata(result.metadata),
            )
            for result in results
        ]

    def _classify_frames(
        self,
        frame_parts: list[genai_types.Part | str],
        *,
        original_filename: str,
        incident_id: str | None,
        camera_id: str | None,
    ) -> IncidentClassification:
        prompt = self._classification_prompt(
            original_filename=original_filename,
            incident_id=incident_id,
            camera_id=camera_id,
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt, *frame_parts],
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IncidentClassification,
            ),
        )

        if not response.text:
            raise VideoAnalysisError("Gemini returned an empty response for video classification.")

        try:
            return IncidentClassification.model_validate_json(response.text)
        except ValidationError as error:
            raise VideoAnalysisError(
                f"Gemini returned a malformed classification payload: {error}"
            ) from error

    def _classification_prompt(
        self,
        *,
        original_filename: str,
        incident_id: str | None,
        camera_id: str | None,
    ) -> str:
        return "\n".join(
            [
                "You are the Respondo video analysis agent.",
                "Review the sampled security-camera frames and classify the incident.",
                "If the scene indicates an active or urgent security/emergency issue that needs on-site action, set flagged=true.",
                "If the frames are benign, ambiguous, or non-urgent, set flagged=false and use incident_type=NON_ACTIONABLE.",
                "Choose incident_type from: "
                + ", ".join(INCIDENT_TYPES)
                + ".",
                "Use departments and actions that are operationally concise.",
                "If flagged=false, manual_search_query must be null, and recommended_actions should focus on monitoring or no action.",
                "If flagged=true, manual_search_query should be a short semantic query for the manual corpus.",
                "",
                "Available department names to prefer when relevant:",
                "- Security Team",
                "- Security Monitoring Team",
                "- Fire Department",
                "- Medical Response Team",
                "- Emergency Services",
                "- Facility Management",
                "- Local Police Department",
                "",
                "Incident metadata:",
                json.dumps(
                    {
                        "filename": original_filename,
                        "incident_id": incident_id,
                        "camera_id": camera_id,
                    },
                    indent=2,
                ),
            ]
        )

    def _extract_frames(
        self,
        video_path: Path,
    ) -> tuple[list[FrameSample], list[genai_types.Part | str]]:
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise VideoAnalysisError(f"Could not open video file {video_path}.")

        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
        frame_positions = self._sample_frame_positions(total_frames)

        frames: list[FrameSample] = []
        parts: list[genai_types.Part | str] = []
        for position in frame_positions:
            capture.set(cv2.CAP_PROP_POS_FRAMES, position)
            success, frame = capture.read()
            if not success:
                continue

            encoded, jpg = cv2.imencode(".jpg", frame)
            if not encoded:
                continue

            timestamp_seconds = round(position / fps, 2) if fps > 0 else 0.0
            frames.append(
                FrameSample(
                    timestamp_seconds=timestamp_seconds,
                    frame_index=position,
                )
            )
            parts.append(f"Frame sampled at {timestamp_seconds:.2f} seconds.")
            parts.append(
                genai_types.Part.from_bytes(
                    data=jpg.tobytes(),
                    mime_type="image/jpeg",
                )
            )

        capture.release()
        return frames, parts

    def _sample_frame_positions(self, total_frames: int) -> list[int]:
        if total_frames <= 0:
            return [0]
        sample_count = min(self.frame_sample_count, total_frames)
        if sample_count == 1:
            return [0]

        return sorted(
            {
                round(index * (total_frames - 1) / (sample_count - 1))
                for index in range(sample_count)
            }
        )

    def _create_vector_stores(self) -> tuple[ChromaVectorStore, ChromaVectorStore]:
        def embed_with_task(task_type: str):
            def embed(texts: list[str]) -> list[list[float]]:
                response = self.client.models.embed_content(
                    model=self.embedding_model,
                    contents=texts,
                    config=genai_types.EmbedContentConfig(taskType=task_type),
                )
                return [list(embedding.values) for embedding in response.embeddings]

            return embed

        document_store = ChromaVectorStore(
            collection_name=self.collection_name,
            embedding_function=embed_with_task("RETRIEVAL_DOCUMENT"),
            path=str(self.chroma_path),
        )
        query_store = ChromaVectorStore(
            collection_name=self.collection_name,
            embedding_function=embed_with_task("RETRIEVAL_QUERY"),
            path=str(self.chroma_path),
        )
        return document_store, query_store

    def _list_manual_documents(self) -> list[Path]:
        return sorted(
            path
            for path in self.manual_docs_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_MANUAL_EXTENSIONS
        )

    def _build_chunks_for_document(
        self,
        document_path: Path,
        relative_path: Path,
        chunker: FixedTokenChunker,
    ) -> list[Chunk]:
        if document_path.suffix.lower() == ".jsonl":
            return self._read_jsonl_chunks(document_path, relative_path)

        text = self._read_manual_document(document_path)
        if not text.strip():
            return []

        metadata = {
            "source_path": str(relative_path),
            "file_name": document_path.name,
            "file_ext": document_path.suffix.lower(),
        }
        chunks = chunker.chunk(
            text,
            document=str(relative_path),
            metadata=metadata,
        )
        for index, chunk in enumerate(chunks):
            chunk.id = _stable_chunk_id(relative_path, index)
            chunk.metadata["chunk_index"] = index
            chunk.metadata["document_title"] = document_path.stem
        return chunks

    def _read_manual_document(self, path: Path) -> str:
        if path.suffix.lower() == ".md":
            return path.read_text(encoding="utf-8")
        return MediaParser.get_text(str(path))

    def _read_jsonl_chunks(self, path: Path, relative_path: Path) -> list[Chunk]:
        chunks: list[Chunk] = []
        with path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                line = raw_line.strip()
                if not line:
                    continue

                try:
                    payload = json.loads(line)
                except json.JSONDecodeError as error:
                    raise VideoAnalysisError(
                        f"Invalid JSON in {path} at line {line_number}: {error}"
                    ) from error

                if not isinstance(payload, dict):
                    raise VideoAnalysisError(
                        f"Each JSONL line in {path} must be an object. Failed at line {line_number}."
                    )

                content = (
                    payload.get("content")
                    or payload.get("text")
                    or payload.get("document")
                )
                if not isinstance(content, str) or not content.strip():
                    raise VideoAnalysisError(
                        f"JSONL chunk in {path} line {line_number} is missing a usable text field."
                    )

                metadata = payload.get("metadata") or {}
                if not isinstance(metadata, dict):
                    raise VideoAnalysisError(
                        f"JSONL chunk metadata in {path} line {line_number} must be an object."
                    )

                chunk_index = metadata.get("chunk_index")
                if not isinstance(chunk_index, int):
                    chunk_index = len(chunks)

                chunk_id = payload.get("id")
                if chunk_id is not None and not isinstance(chunk_id, str):
                    raise VideoAnalysisError(
                        f"JSONL chunk id in {path} line {line_number} must be a string."
                    )

                chunks.append(
                    Chunk(
                        id=chunk_id or _stable_chunk_id(relative_path, chunk_index),
                        content=content,
                        document=str(relative_path),
                        metadata={
                            **metadata,
                            "chunk_index": chunk_index,
                            "source_path": str(relative_path),
                            "file_name": path.name,
                            "file_ext": path.suffix.lower(),
                            "document_title": path.stem,
                            "line_number": line_number,
                        },
                    )
                )
        return chunks

    def _compute_signature(self, paths: list[Path]) -> str:
        hasher = hashlib.sha256()
        for path in paths:
            stat = path.stat()
            hasher.update(str(path).encode("utf-8"))
            hasher.update(str(stat.st_size).encode("utf-8"))
            hasher.update(str(stat.st_mtime_ns).encode("utf-8"))
        return hasher.hexdigest()

    def _manifest_path(self) -> Path:
        safe_collection = self.collection_name.replace("/", "_")
        return self.chroma_path / f"{safe_collection}.manifest.json"

    def _read_manifest(self, manifest_path: Path) -> dict[str, Any] | None:
        if not manifest_path.is_file():
            return None

        try:
            return json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None

    def _write_trace(self, response: VideoAnalysisResponse) -> None:
        session_id = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}"
        trace_path = self.trace_directory / f"{session_id}.json"
        trace_path.write_text(
            json.dumps(response.model_dump(mode="json"), indent=2),
            encoding="utf-8",
        )


def _stable_chunk_id(relative_path: Path, chunk_index: int) -> str:
    digest = hashlib.sha256(f"{relative_path}:{chunk_index}".encode("utf-8")).hexdigest()
    return digest[:32]


def _sanitize_metadata(
    metadata: dict[str, Any],
) -> dict[str, str | int | float | bool | None]:
    clean: dict[str, str | int | float | bool | None] = {}
    for key, value in metadata.items():
        if value is None or isinstance(value, (str, int, float, bool)):
            clean[key] = value
        else:
            clean[key] = str(value)
    return clean


def _read_positive_int(name: str, fallback: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return fallback
    value = int(raw)
    if value <= 0:
        raise AgentConfigurationError(f"{name} must be a positive integer.")
    return value


def _read_non_negative_int(name: str, fallback: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return fallback
    value = int(raw)
    if value < 0:
        raise AgentConfigurationError(f"{name} must be a non-negative integer.")
    return value


def _read_optional_env(name: str) -> str | None:
    raw = os.getenv(name, "").strip()
    return raw or None


def _read_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )


def _read_boolean_env(name: str, fallback: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return fallback
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise AgentConfigurationError(f"{name} must be a boolean value.")
