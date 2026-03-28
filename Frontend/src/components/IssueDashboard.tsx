import { useState } from 'react'
import { useIssues } from '../hooks/useIssues'
import type { Issue, IssueStatus } from '../types'
import { ClassifyIssueDialog } from './ClassifyIssueDialog'
import { IssueAgentChat } from './IssueAgentChat'

const statusLabel: Record<IssueStatus, string> = {
  unresolved: 'Unresolved',
  resolved: 'Resolved',
  incorrectly_classified: 'Incorrectly classified',
}

function StatusTag({ status }: { status: IssueStatus }) {
  return (
    <span className={`issue-tag issue-tag--${status}`}>
      {statusLabel[status]}
    </span>
  )
}

function IssueCard({
  issue,
  onOpenChat,
  onOpenClassify,
}: {
  issue: Issue
  onOpenChat: (issue: Issue) => void
  onOpenClassify: (issue: Issue) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <article className={`issue-card${open ? ' issue-card--open' : ''}`}>
      <button
        type="button"
        className="issue-card-header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="issue-card-header-main">
          <h2 className="issue-card-title">{issue.title}</h2>
          <div className="issue-card-meta">
            <time dateTime={`${issue.date}T${issue.time}`}>
              {issue.date} · {issue.time}
            </time>
          </div>
        </div>
        <StatusTag status={issue.status} />
        <span className="issue-card-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div className="issue-card-body">
          <div className="issue-video" role="img" aria-label="Video placeholder">
            <div className="issue-video-inner">
              <span className="issue-video-icon" aria-hidden />
              <span>Video feed placeholder</span>
              <span className="issue-video-hint">
                Notion attachment will appear here
              </span>
            </div>
          </div>

          <div className="issue-detail-grid">
            <div>
              <p className="field-label">Date</p>
              <p className="field-value">{issue.date}</p>
            </div>
            <div>
              <p className="field-label">Time</p>
              <p className="field-value">{issue.time}</p>
            </div>
          </div>

          <div>
            <p className="field-label">Description</p>
            <p className="issue-description">{issue.description}</p>
          </div>

          <div>
            <p className="field-label">Reason flagged (agent)</p>
            <p className="issue-reason-flagged">{issue.reason_flagged}</p>
          </div>

          <div className="issue-dock">
            <p className="field-label">Security manual dock</p>
            <p className="issue-dock-dept">
              Contact department:{' '}
              <strong>{issue.security_manual_dock.contact_department}</strong>
            </p>
            <p className="field-label issue-dock-trail-label">Section trail</p>
            <ol className="issue-dock-trail">
              {issue.security_manual_dock.section_trail.map((segment, index) => (
                <li key={`${issue.id}-trail-${index}`}>{segment}</li>
              ))}
            </ol>
            <pre className="issue-dock-snippet" tabIndex={0}>
              {issue.security_manual_dock.snippet}
            </pre>
          </div>

          <div className="issue-actions-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onOpenChat(issue)}
            >
              Open issue chat
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => onOpenClassify(issue)}
            >
              Classify issue
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function IssueDashboard() {
  const { issues, classifyIssue } = useIssues()
  const [classifyingIssue, setClassifyingIssue] = useState<Issue | null>(null)
  const [chatIssue, setChatIssue] = useState<Issue | null>(null)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Issue dashboard</h1>
        <p className="page-lead">
          Review incidents, see why they were flagged, inspect the current
          security-manual route, and hand the case off to a human reviewer.
        </p>
      </div>

      <div className="dashboard-layout">
        <section className="issue-list" aria-label="Issues">
          {issues.map((issue) => (
            <div key={issue.id} className="issue-stack">
              <IssueCard
                issue={issue}
                onOpenChat={setChatIssue}
                onOpenClassify={setClassifyingIssue}
              />
            </div>
          ))}
        </section>

        <IssueAgentChat key={chatIssue?.id ?? 'empty'} issue={chatIssue} />
      </div>

      <ClassifyIssueDialog
        key={classifyingIssue?.id ?? 'closed'}
        issue={classifyingIssue}
        open={classifyingIssue !== null}
        onClose={() => setClassifyingIssue(null)}
        onSave={(status: IssueStatus, note: string) => {
          if (!classifyingIssue) return
          classifyIssue(classifyingIssue.id, status, note)
        }}
      />
    </div>
  )
}
