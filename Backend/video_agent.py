import base64
import json
import re

import cv2
import railtracks as rt
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

load_dotenv()


class VideoIssueAnalysisResult(BaseModel):
    """Structured output from the issue-classification vision agent."""

    reason_flagged_as_issue: str | None = Field(
        default=None,
        description=(
            "If the video warrants triage as an incident or issue, a short reason why; "
            "otherwise null."
        ),
    )

    @field_validator("reason_flagged_as_issue", mode="before")
    @classmethod
    def _empty_reason_to_none(cls, v: object) -> object:
        if v == "" or v is None:
            return None
        return v

    video_description: str = Field(
        ...,
        description="Neutral overall summary of what the video shows.",
    )


def _extract_json_object(raw: str) -> str:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return text


def _parse_issue_analysis(raw: str) -> VideoIssueAnalysisResult:
    try:
        payload = json.loads(_extract_json_object(raw))
    except json.JSONDecodeError as e:
        raise ValueError(f"Model did not return valid JSON: {e}") from e
    if not isinstance(payload, dict):
        raise ValueError("Model JSON must be an object")
    return VideoIssueAnalysisResult.model_validate(payload)

# --- Config ---
# Sample every Nth frame (cookbook uses every 25th).
# Lower = more frames = better understanding, but more tokens.
FRAME_SAMPLE_RATE = 25

# --- Step 1: Extract frames from video (OpenAI cookbook approach) ---
def extract_frames(video_path: str) -> list[str]:
    """Extract every Nth frame from a video, return as base64 strings."""
    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    base64_frames = []
    while video.isOpened():
        success, frame = video.read()
        if not success:
            break
        _, buffer = cv2.imencode(".jpg", frame)
        base64_frames.append(base64.b64encode(buffer).decode("utf-8"))

    video.release()

    # Sample every Nth frame to avoid sending thousands of frames
    sampled = base64_frames[0::FRAME_SAMPLE_RATE]
    print(f"📽️  Total frames: {len(base64_frames)} → Sampled: {len(sampled)} (every {FRAME_SAMPLE_RATE}th frame)")
    return sampled

# --- Step 2: Define the Railtracks agent (issue triage + structured JSON) ---
VideoIssueClassificationAgent = rt.agent_node(
    llm=rt.llm.OpenAILLM("gpt-4o"),
    system_message=(
        "You are an operations and incident triage assistant reviewing facility and "
        "security-style footage. You receive frames sampled from a video (not every frame). "
        "Decide whether the content suggests something staff should treat as an incident or "
        "issue worth follow-up. Flag as an issue when you see credible signs of: safety hazards, "
        "injury or medical emergency, fire or smoke, flooding or major leaks, property damage or "
        "vandalism, theft or break-in, aggressive conflict or assault, clear security breaches, "
        "or other serious operational or policy problems. "
        "Do not flag routine, benign activity with no apparent problem. "
        "If uncertain but there is a plausible safety or security concern, err on flagging with "
        "a clear, factual reason. "
        "You must reply with a single JSON object only—no markdown fences, no prose before or after."
    ),
)

# --- Step 3: Core analysis (shared by CLI and API) ---
async def run_video_analysis(video_path: str) -> VideoIssueAnalysisResult:
    print(f"\n📂 Loading video: {video_path}")
    frames_b64 = extract_frames(video_path)
    print(f"🖼️  Sending {len(frames_b64)} frames to agent...\n")

    message_history = rt.llm.MessageHistory([
        rt.llm.UserMessage(
            content=(
                "These are frames sampled from a video (every Nth frame). "
                "Classify whether this footage indicates an issue that should be triaged. "
                "Output exactly one JSON object with these keys:\n"
                '- "reason_flagged_as_issue": a short string explaining why this is an issue, '
                "or null if you are not flagging it as an issue.\n"
                '- "video_description": a clear, neutral summary of what the video shows overall '
                "(people, setting, actions, and timeline in plain language).\n"
                "Use null (JSON null) for reason_flagged_as_issue when there is no issue."
            ),
            attachment=frames_b64,
        )
    ])

    raw = await rt.call(VideoIssueClassificationAgent, message_history)
    text = raw if isinstance(raw, str) else str(raw)
    return _parse_issue_analysis(text)


@rt.function_node
async def analyze_video(video_path: str):
    result = await run_video_analysis(video_path)
    return result.model_dump()

# --- Step 4: Run ---
if __name__ == "__main__":
    video_path = input("Enter path to video file: ").strip()

    flow = rt.Flow("Video Issue Classification", entry_point=analyze_video)
    output = flow.invoke(video_path)

    print("=" * 60)
    print("🎬 Agent Output (JSON):")
    print("=" * 60)
    print(json.dumps(output, indent=2, ensure_ascii=False))