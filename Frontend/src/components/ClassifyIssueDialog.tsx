import { useState } from 'react'
import type { Issue, IssueStatus } from '../types'

type ClassifyIssueDialogProps = {
  issue: Issue | null
  open: boolean
  onClose: () => void
  onSave: (status: IssueStatus, note: string) => void
}

const statusOptions: { value: IssueStatus; label: string }[] = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'incorrectly_classified', label: 'Incorrectly classified' },
]

export function ClassifyIssueDialog({
  issue,
  open,
  onClose,
  onSave,
}: ClassifyIssueDialogProps) {
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? 'unresolved')
  const [note, setNote] = useState(issue?.classificationNote ?? '')

  if (!open || !issue) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classify-issue-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="dialog-eyebrow">Classify issue</p>
            <h2 id="classify-issue-title" className="dialog-title">
              {issue.title}
            </h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="dialog-body">
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value as IssueStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Classification note</span>
            <textarea
              className="input input--textarea"
              rows={5}
              placeholder="Explain why the issue was resolved, escalated, or marked incorrect."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave(status, note)
              onClose()
            }}
          >
            Save classification
          </button>
        </div>
      </div>
    </div>
  )
}
