import { useMemo, useState } from 'react'
import type { Issue, IssueChatMessage } from '../types'

type IssueAgentChatProps = {
  issue: Issue | null
}

function buildAssistantReply(issue: Issue, prompt: string) {
  const normalized = prompt.toLowerCase()

  if (
    normalized.includes('manual') ||
    normalized.includes('department') ||
    normalized.includes('who')
  ) {
    return `The current manual route points to ${issue.security_manual_dock.contact_department}. Section trail: ${issue.security_manual_dock.section_trail.join(' > ')}.`
  }

  if (normalized.includes('flag') || normalized.includes('why')) {
    return `The clip was flagged because: ${issue.reason_flagged}`
  }

  if (normalized.includes('escalat')) {
    return `Recommended escalation for "${issue.title}": preserve the footage, confirm the timeline, and notify ${issue.security_manual_dock.contact_department} for the first on-site response.`
  }

  if (normalized.includes('summary') || normalized.includes('brief')) {
    return `Summary: ${issue.description}`
  }

  return `For "${issue.title}", I would preserve the video evidence, confirm the timeline, keep the issue ${issue.status.replaceAll('_', ' ')}, and use the manual dock note as the starting point for the human handoff.`
}

export function IssueAgentChat({ issue }: IssueAgentChatProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<IssueChatMessage[]>([])

  const seededMessages = useMemo<IssueChatMessage[]>(() => {
    if (!issue) return []
    return [
      {
        id: `${issue.id}-intro`,
        role: 'assistant',
        content:
          'Issue agent ready. Ask for a summary, why it was flagged, or which department the current manual route recommends.',
      },
    ]
  }, [issue])

  if (!issue) {
    return (
      <section className="chat-panel">
        <div className="chat-empty">
          <h2 className="panel-title">Issue agent chat</h2>
          <p>Select an issue to open the chat assistant scaffold.</p>
        </div>
      </section>
    )
  }

  const allMessages = [...seededMessages, ...messages]

  return (
    <section className="chat-panel" aria-labelledby="issue-chat-heading">
      <div className="chat-header">
        <div>
          <p className="panel-eyebrow">Assistant UI scaffold</p>
          <h2 id="issue-chat-heading" className="panel-title">
            {issue.title}
          </h2>
        </div>
        <span className="shell-pill">Issue agent</span>
      </div>

      <div className="chat-thread">
        {allMessages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble chat-bubble--${message.role}`}
          >
            <p className="chat-role">
              {message.role === 'assistant' ? 'Assistant' : 'You'}
            </p>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          const prompt = draft.trim()
          if (!prompt) return

          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: 'user',
              content: prompt,
            },
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: buildAssistantReply(issue, prompt),
            },
          ])
          setDraft('')
        }}
      >
        <input
          className="input"
          placeholder="Ask for a summary, why it was flagged, or who to notify"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn btn--primary">
          Send
        </button>
      </form>
    </section>
  )
}
