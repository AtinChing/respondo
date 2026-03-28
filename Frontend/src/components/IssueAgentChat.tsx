/**
 * Chat UI: DefaultChatTransport → POST /api/chat.
 * Renders text and visible tool calls (e.g. Report generation agent).
 */
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai'

type ChatPart = UIMessage['parts'][number]
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useIssueReports } from '../context/IssueReportsContext'
import type { Issue } from '../types'

function messageText(parts: ChatPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
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
      return 'Calling Report generation agent…'
    case 'output-available':
      return 'Finished — report ready for Assets'
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
  if (state === 'output-available' && 'output' in part && part.output && typeof part.output === 'object') {
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
  issue: Issue
  onClose: () => void
}

export function IssueAgentChat({ issue, onClose }: IssueAgentChatProps) {
  const issueBody = useMemo(() => ({ ...issue }), [issue])
  const { appendReport } = useIssueReports()
  const issueRef = useRef(issue)
  useEffect(() => {
    issueRef.current = issue
  }, [issue])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { issueContext: issueBody },
      }),
    [issueBody],
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    id: `issue-chat-${issue.id}`,
    transport,
    onFinish: ({ message }) => {
      if (message.role !== 'assistant') return
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
          if (o.reportId && o.reportMarkdown) {
            appendReport({
              id: o.reportId,
              issueId: o.issueId || issueRef.current.id,
              issueTitle: issueRef.current.title,
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

  return (
    <div className="gemini-chat-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="gemini-chat-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-chat-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gemini-chat-header">
          <div className="gemini-chat-header-text">
            <h2 id="gemini-chat-title" className="gemini-chat-title">
              Incident agent
            </h2>
            <p className="gemini-chat-subtitle">{issue.title}</p>
          </div>
          <button
            type="button"
            className="gemini-chat-close"
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        </header>

        <div className="gemini-chat-thread" ref={viewportRef}>
          {messages.length === 0 && (
            <p className="gemini-chat-empty">
              Ask about this incident or say <strong>“Please generate an issue report for me.”</strong>{' '}
              The agent can call the <strong>Report generation agent</strong> tool (shown in the
              thread). Full Markdown is saved under <strong>Assets</strong>.
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
                  <span className="gemini-msg-label">Agent</span>
                  {body}
                </div>
              )
            }
            return null
          })}
        </div>

        {error && (
          <p className="gemini-chat-error" role="alert">
            {error.message}
          </p>
        )}

        <footer className="gemini-composer-wrap">
          <form
            className="gemini-composer"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget
              const fd = new FormData(form)
              const text = String(fd.get('message') ?? '').trim()
              if (!text || busy) return
              form.reset()
              await sendMessage({ text })
            }}
          >
            <textarea
              name="message"
              className="gemini-composer-input"
              placeholder="Message incident agent…"
              rows={1}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            {busy ? (
              <button type="button" className="gemini-composer-send" onClick={() => stop()}>
                Stop
              </button>
            ) : (
              <button type="submit" className="gemini-composer-send">
                Send
              </button>
            )}
          </form>
        </footer>
      </aside>
    </div>
  )
}
