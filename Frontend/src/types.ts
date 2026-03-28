export type IssueStatus =
  | 'unresolved'
  | 'resolved'
  | 'incorrectly_classified'

/**
 * One retrieved chunk from the security manual (vector store / recursive split).
 * The trail mirrors coarse→fine splits; the snippet is the leaf text that routes to a department.
 */
export type SecurityManualDock = {
  section_trail: string[]
  snippet: string
  contact_department: string
}

export type Issue = {
  id: string
  title: string
  date: string
  time: string
  description: string
  status: IssueStatus
  security_manual_dock: SecurityManualDock
  /** Why the video agent flagged this clip as an issue. */
  reason_flagged: string
}

export type Member = {
  id: string
  phone: string
  email: string
}

export type Department = {
  id: string
  name: string
  members: Member[]
}
