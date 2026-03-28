import { useCallback, useEffect, useState } from 'react'
import { issues as seedIssues } from '../data/issues'
import type { Issue, IssueStatus, SecurityManualDock } from '../types'

const STORAGE_KEY = 'respondo-issues'

const seedById = new Map(seedIssues.map((issue) => [issue.id, issue]))

const DEFAULT_DOCK: SecurityManualDock = {
  section_trail: ['Security manual', 'Unindexed'],
  snippet:
    'No security-manual excerpt is on file for this issue yet. Ingest vector chunks to populate department routing guidance.',
  contact_department: 'Operations',
}

function normalizeDock(
  raw: unknown,
  fallback: SecurityManualDock,
): SecurityManualDock {
  if (!raw || typeof raw !== 'object') return fallback
  const dock = raw as Record<string, unknown>
  return {
    section_trail: Array.isArray(dock.section_trail)
      ? dock.section_trail.filter((segment): segment is string => typeof segment === 'string')
      : fallback.section_trail,
    snippet:
      typeof dock.snippet === 'string' ? dock.snippet : fallback.snippet,
    contact_department:
      typeof dock.contact_department === 'string'
        ? dock.contact_department
        : fallback.contact_department,
  }
}

function normalizeIssue(raw: unknown): Issue | null {
  if (!raw || typeof raw !== 'object') return null
  const issue = raw as Partial<Issue> & { id?: string }
  if (!issue.id) return null

  const seed = seedById.get(issue.id)
  const dockFallback = seed?.security_manual_dock ?? DEFAULT_DOCK

  return {
    id: issue.id,
    title: typeof issue.title === 'string' ? issue.title : seed?.title ?? 'Untitled issue',
    date: typeof issue.date === 'string' ? issue.date : seed?.date ?? '',
    time: typeof issue.time === 'string' ? issue.time : seed?.time ?? '',
    description:
      typeof issue.description === 'string'
        ? issue.description
        : seed?.description ?? '',
    status:
      issue.status === 'unresolved' ||
      issue.status === 'resolved' ||
      issue.status === 'incorrectly_classified'
        ? issue.status
        : seed?.status ?? 'unresolved',
    reason_flagged:
      typeof issue.reason_flagged === 'string'
        ? issue.reason_flagged
        : seed?.reason_flagged ?? 'No stored flag reason is available yet.',
    security_manual_dock: normalizeDock(issue.security_manual_dock, dockFallback),
    location: typeof issue.location === 'string' ? issue.location : seed?.location,
    department:
      typeof issue.department === 'string'
        ? issue.department
        : seed?.department,
    classificationNote:
      typeof issue.classificationNote === 'string'
        ? issue.classificationNote
        : seed?.classificationNote,
  }
}

function loadIssues(): Issue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedIssues

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return seedIssues

    const merged = parsed
      .map(normalizeIssue)
      .filter((issue): issue is Issue => issue !== null)

    return merged.length > 0 ? merged : seedIssues
  } catch {
    return seedIssues
  }
}

function persistIssues(issues: Issue[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues))
}

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>(() => loadIssues())

  useEffect(() => {
    persistIssues(issues)
  }, [issues])

  const classifyIssue = useCallback(
    (issueId: string, status: IssueStatus, classificationNote: string) => {
      setIssues((current) =>
        current.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                status,
                classificationNote: classificationNote.trim() || undefined,
              }
            : issue,
        ),
      )
    },
    [],
  )

  const addIssue = useCallback((issue: Issue) => {
    setIssues((current) => [issue, ...current])
  }, [])

  return {
    issues,
    classifyIssue,
    addIssue,
  }
}
