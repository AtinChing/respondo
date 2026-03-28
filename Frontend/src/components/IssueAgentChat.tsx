/**
 * Chat UI using the same Vercel AI SDK + HTTP streaming pattern described in
 * ASSISTANT_UI_DOCS.md (Thread + Composer layout). Transport: DefaultChatTransport → POST /api/chat.
 * Presentation follows Gemini-style chat (soft shell, rounded bubbles); model is fixed on the server.
 */
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useRef } from 'react'
import type { Issue } from '../types'

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

type IssueAgentChatProps = {
  issue: Issue
  onClose: () => void
}

export function IssueAgentChat({ issue, onClose }: IssueAgentChatProps) {
  const issueBody = useMemo(
    () => ({
      issueId: issue.id,
      title: issue.title,
      date: issue.date,
      time: issue.time,
      description: issue.description,
      status: issue.status,
      reason_flagged: issue.reason_flagged,
      security_manual_dock: {
        section_trail: issue.security_manual_dock.section_trail,
        snippet: issue.security_manual_dock.snippet,
        contact_department: issue.security_manual_dock.contact_department,
      },
    }),
    [issue],
  )

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
              Ask about this incident, next steps, or how to document it. Replies stream from the
              server; the model is fixed and not selectable here.
            </p>
          )}
          {messages.map((m) => {
            if (m.role !== 'user' && m.role !== 'assistant') return null
            const text = messageText(m.parts)
            if (!text.trim()) return null
            return (
              <div
                key={m.id}
                className={`gemini-msg gemini-msg--${m.role}`}
              >
                <span className="gemini-msg-label">
                  {m.role === 'user' ? 'You' : 'Agent'}
                </span>
                <div className="gemini-msg-bubble">{text}</div>
              </div>
            )
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
