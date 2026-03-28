"""
Railtracks agent: turns full incident context into a shareable Markdown issue report.
Context is supplied as multiple string segments (joined before the LLM call).
"""

import uuid

import railtracks as rt
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

ReportGenerationAgent = rt.agent_node(
    llm=rt.llm.OpenAILLM("gpt-4o-mini"),
    system_message=(
        "You are the Report generation agent for Respondo operations. "
        "Staff will send one or more text sections describing a single security or facilities incident "
        "(metadata, video description, why it was flagged, manual excerpts, etc.). "
        "Write a polished incident report in Markdown that could be forwarded to management, "
        "security, or facilities. "
        "Use clear structure with headings (# and ##), bullet lists where helpful, and **bold** for "
        "critical facts. "
        "Do not wrap the entire report in a Markdown code fence. "
        "Base every factual claim on the provided context; if something is unknown, say so explicitly. "
        "Include sections such as: Summary, Incident details, Timeline (if inferable), "
        "Automated assessment / reason flagged, Policy or manual alignment (if provided), "
        "Recommended next steps, and Open questions (if any)."
    ),
)


class GenerateIssueReportRequest(BaseModel):
    """All incident context, as separate strings (e.g. one per major section)."""

    issue_context_segments: list[str] = Field(
        ...,
        description="Every context string about the issue; order is preserved when joined.",
    )


class GenerateIssueReportResponse(BaseModel):
    report_id: str
    report_markdown: str


def _bundle_segments(segments: list[str]) -> str:
    parts = [s.strip() for s in segments if s and str(s).strip()]
    if not parts:
        raise ValueError("issue_context_segments must contain at least one non-empty string")
    return "\n\n---\n\n".join(parts)


async def run_issue_report_generation(issue_context_segments: list[str]) -> str:
    bundle = _bundle_segments(issue_context_segments)
    history = rt.llm.MessageHistory(
        [
            rt.llm.UserMessage(
                content=(
                    "Using only the incident context below, produce the Markdown incident report.\n\n"
                    f"{bundle}"
                ),
            )
        ]
    )
    raw = await rt.call(ReportGenerationAgent, history)
    return raw if isinstance(raw, str) else str(raw)


async def generate_issue_report_api(
    body: GenerateIssueReportRequest,
) -> GenerateIssueReportResponse:
    markdown = await run_issue_report_generation(body.issue_context_segments)
    return GenerateIssueReportResponse(
        report_id=str(uuid.uuid4()),
        report_markdown=markdown.strip(),
    )
