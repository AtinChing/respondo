export type IssueStatus =
  | 'unresolved'
  | 'resolved'
  | 'incorrectly_classified'

export type Issue = {
  id: string
  title: string
  date: string
  time: string
  description: string
  status: IssueStatus
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
