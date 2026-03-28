import { useState } from 'react'
import type { Issue, IssueStatus } from '../types'
import { useIssues } from '../hooks/useIssues'
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
  onSetStatus,
  onDelete,
}: {
  issue: Issue
  onSetStatus: (id: string, status: IssueStatus) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [classifyOpen, setClassifyOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <article className={`issue-card${open ? ' issue-card--open' : ''}`}>
        <div className="issue-card-top">
          <button
            type="button"
            className="issue-card-header"
            onClick={() => setOpen((v) => !v)}
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
          <button
            type="button"
            className="issue-card-delete"
            aria-label={`Delete issue: ${issue.title}`}
            onClick={(e) => {
              e.stopPropagation()
              if (
                window.confirm(
                  `Remove this issue from the dashboard?\n\n${issue.title}`,
                )
              ) {
                onDelete(issue.id)
              }
            }}
          >
            Delete
          </button>
        </div>

        {open && (
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
              <p className="field-label">Security manual dock (vector chunk)</p>
              <p className="issue-dock-dept">
                Contact department:{' '}
                <strong>{issue.security_manual_dock.contact_department}</strong>
              </p>
              <p className="field-label issue-dock-trail-label">Section trail</p>
              <ol className="issue-dock-trail">
                {issue.security_manual_dock.section_trail.map((seg, idx) => (
                  <li key={`${issue.id}-trail-${idx}`}>{seg}</li>
                ))}
              </ol>
              <pre className="issue-dock-snippet" tabIndex={0}>
                {issue.security_manual_dock.snippet}
              </pre>
            </div>
            <div className="issue-actions-row">
              <button
                type="button"
                className="btn btn--secondary issue-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setClassifyOpen(true)
                }}
              >
                Classify issue
              </button>
              <button
                type="button"
                className="btn btn--primary issue-action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setChatOpen(true)
                }}
              >
                Chat with agent
              </button>
            </div>
          </div>
        )}
      </article>

      <ClassifyIssueDialog
        open={classifyOpen}
        title={issue.title}
        onClose={() => setClassifyOpen(false)}
        onSelect={(status) => onSetStatus(issue.id, status)}
      />

      {chatOpen && (
        <IssueAgentChat issue={issue} onClose={() => setChatOpen(false)} />
      )}
    </>
  )
}

export function IssueDashboard() {
  const { issues, setStatus, removeIssue } = useIssues()

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Issue dashboard</h1>
        <p className="page-lead">
          Review incidents, media, and classification status. Issues persist in
          your browser (localStorage); connect Notion when you are ready.
        </p>
      </div>

      <section className="issue-list" aria-label="Issues">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onSetStatus={setStatus}
            onDelete={removeIssue}
          />
        ))}
      </section>
    </div>
  )
}
