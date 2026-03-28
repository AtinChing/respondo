import type { IssueStatus } from '../types'

type ClassifyIssueDialogProps = {
  open: boolean
  title: string
  onClose: () => void
  onSelect: (status: Exclude<IssueStatus, 'unresolved'>) => void
}

export function ClassifyIssueDialog({
  open,
  title,
  onClose,
  onSelect,
}: ClassifyIssueDialogProps) {
  if (!open) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classify-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="classify-dialog-title" className="dialog-title">
          Classify issue
        </h2>
        <p className="dialog-subtitle">
          Choose how to update <span className="dialog-issue-name">{title}</span>.
          This is saved in local storage for now.
        </p>
        <div className="dialog-actions-row">
          <button
            type="button"
            className="classify-btn classify-btn--resolved"
            onClick={() => {
              onSelect('resolved')
              onClose()
            }}
          >
            Resolved
          </button>
          <button
            type="button"
            className="classify-btn classify-btn--incorrect"
            onClick={() => {
              onSelect('incorrectly_classified')
              onClose()
            }}
          >
            Incorrectly classified
          </button>
        </div>
        <button type="button" className="btn btn--ghost dialog-dismiss" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
