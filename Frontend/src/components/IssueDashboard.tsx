import { useState } from 'react'
import type { Issue, IssueStatus } from '../types'
import { issues as issueData } from '../data/issues'

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

function IssueCard({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)

  return (
    <article className={`issue-card${open ? ' issue-card--open' : ''}`}>
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
        </div>
      )}
    </article>
  )
}

export function IssueDashboard() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Issue dashboard</h1>
        <p className="page-lead">
          Review incidents, media, and classification status. Data is static
          JSON for now; Notion sync comes next.
        </p>
      </div>

      <section className="issue-list" aria-label="Issues">
        {issueData.map((issue: Issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </section>
    </div>
  )
}
