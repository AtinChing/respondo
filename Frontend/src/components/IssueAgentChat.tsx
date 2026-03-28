/**
 * Issue agent: streams from Vite `/api/chat` (Gemini + generateIssueReport tool → FastAPI report agent).
 */
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  isToolUIPart,
  type UIMessage,
} from 'ai'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIssueReports } from '../context/IssueReportsContext'
import type { Issue } from '../types'

type ChatPart = UIMessage['parts'][number]

function messageText(parts: ChatPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function issueToChatContext(issue: Issue): Record<string, unknown> {
  const { videoPreview, ...rest } = issue
  const ctx: Record<string, unknown> = { ...rest }
  if (videoPreview) {
    ctx.videoAttachment = {
      fileName: videoPreview.fileName,
      mimeType: videoPreview.mimeType,
      note: 'Video is attached in the dashboard; data URL omitted from agent context.',
    }
  }
  return ctx
}

function toolDisplayTitle(part: ChatPart): string | null {
  if (!isToolUIPart(part)) return null
  if (part.type === 'dynamic-tool') return part.toolName
  if (part.type === 'tool-generateIssueReport') return 'Report generation agent'
  if (part.type.startsWith('tool-')) return part.type.slice('tool-'.length)
  return 'Tool'
}

function toolStateLabel(state: string): string {
  switch (state) {
    case 'input-streaming':
      return 'Preparing tool call…'
    case 'input-available':
      return 'Calling report generation agent…'
    case 'output-available':
      return 'Finished — report saved to Assets'
    case 'output-error':
      return 'Tool failed'
    default:
      return state
  }
}

function ToolCallCard({ part }: { part: ChatPart }) {
  if (!isToolUIPart(part)) return null
  const title = toolDisplayTitle(part) ?? 'Tool'
  const state = part.state

  let detail: string | null = null
  if (
    state === 'output-available' &&
    'output' in part &&
    part.output &&
    typeof part.output === 'object'
  ) {
    const o = part.output as { reportId?: string; agentName?: string }
    if (o.reportId) detail = `Report ID: ${o.reportId}`
  }
  if (state === 'output-error' && 'errorText' in part && part.errorText) {
    detail = part.errorText
  }

  return (
    <div className="gemini-tool-card" role="status">
      <div className="gemini-tool-card-head">
        <span className="gemini-tool-card-badge">Tool</span>
        <span className="gemini-tool-card-title">{title}</span>
      </div>
      <p className="gemini-tool-card-state">{toolStateLabel(state)}</p>
      {detail && <p className="gemini-tool-card-detail">{detail}</p>}
    </div>
  )
}

function AssistantMessageBody({ parts }: { parts: ChatPart[] }) {
  const nodes: ReactNode[] = []
  parts.forEach((part, i) => {
    if (part.type === 'text' && part.text.trim()) {
      nodes.push(
        <div key={`t-${i}`} className="gemini-msg-bubble">
          {part.text}
        </div>,
      )
    } else if (part.type === 'step-start' || part.type === 'reasoning') {
      /* skip */
    } else if (isToolUIPart(part)) {
      nodes.push(<ToolCallCard key={part.toolCallId ?? `tool-${i}`} part={part} />)
    }
  })
  if (nodes.length === 0) return null
  return <div className="gemini-msg-stack">{nodes}</div>
}

type IssueAgentChatProps = {
  issue: Issue | null
}

export function IssueAgentChat({ issue }: IssueAgentChatProps) {
  const { appendReport } = useIssueReports()
  const issueRef = useRef(issue)
  issueRef.current = issue

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ body, messages }) => ({
          body: {
            ...(body ?? {}),
            messages,
            issueContext: issueRef.current
              ? issueToChatContext(issueRef.current)
              : undefined,
          },
        }),
      }),
    [],
  )

  const onFinishRef = useRef(appendReport)
  onFinishRef.current = appendReport

  const { messages, sendMessage, status, error, stop } = useChat({
    id: issue ? `issue-chat-${issue.id}` : 'issue-chat-idle',
    transport,
    onFinish: ({ message }) => {
      if (message.role !== 'assistant') return
      const currentIssue = issueRef.current
      if (!currentIssue) return
      for (const part of message.parts) {
        if (
          part.type === 'tool-generateIssueReport' &&
          part.state === 'output-available' &&
          part.output &&
          typeof part.output === 'object'
        ) {
          const o = part.output as {
            reportId?: string
            reportMarkdown?: string
            issueId?: string
          }
          if (o.reportId && o.reportMarkdown !== undefined) {
            onFinishRef.current({
              id: o.reportId,
              issueId: o.issueId || currentIssue.id,
              issueTitle: currentIssue.title,
              createdAt: new Date().toISOString(),
              markdown: o.reportMarkdown,
            })
          }
        }
      }
    },
  })

  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, status])

  const busy = status === 'streaming' || status === 'submitted'
  const [draft, setDraft] = useState('')

  if (!issue) {
    return (
      <section className="chat-panel">
        <div className="chat-empty">
          <h2 className="panel-title">Issue agent chat</h2>
          <p>Select an issue to chat with the assistant.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="chat-panel" aria-labelledby="issue-chat-heading">
      <div className="chat-header">
        <div>
          <p className="panel-eyebrow">Assistant</p>
          <h2 id="issue-chat-heading" className="panel-title">
            {issue.title}
          </h2>
        </div>
        <span className="shell-pill">Issue agent</span>
      </div>

      <div className="chat-thread issue-agent-thread" ref={viewportRef}>
        {messages.length === 0 && (
          <p className="gemini-chat-empty issue-agent-chat-hint">
            Ask about this incident, or say{' '}
            <strong>&quot;Please generate an issue report&quot;</strong> — the assistant will call
            the <strong>Report generation agent</strong> tool (shown in the thread). Open{' '}
            <strong>Assets</strong> to read the full Markdown.
          </p>
        )}
        {messages.map((m) => {
          if (m.role === 'user') {
            const text = messageText(m.parts)
            if (!text.trim()) return null
            return (
              <div key={m.id} className="gemini-msg gemini-msg--user">
                <span className="gemini-msg-label">You</span>
                <div className="gemini-msg-bubble">{text}</div>
              </div>
            )
          }
          if (m.role === 'assistant') {
            const body = <AssistantMessageBody parts={m.parts} />
            if (!body) return null
            return (
              <div key={m.id} className="gemini-msg gemini-msg--assistant">
                <span className="gemini-msg-label">Assistant</span>
                {body}
              </div>
            )
          }
          return null
        })}
        {error && (
          <p className="inline-error" role="alert">
            {error.message}
          </p>
        )}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          const text = draft.trim()
          if (!text || busy) return
          void sendMessage({ text })
          setDraft('')
        }}
      >
        <input
          className="input"
          placeholder="Ask about the incident or request a formal report…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
        {busy ? (
          <button type="button" className="btn btn--secondary" onClick={() => void stop()}>
            Stop
          </button>
        ) : null}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Send
        </button>
      </form>
    </section>
  )
}
