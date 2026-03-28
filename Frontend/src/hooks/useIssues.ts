import { useCallback, useEffect, useState } from 'react'
import type { Issue, IssueStatus, SecurityManualDock } from '../types'
import { issues as seedIssues } from '../data/issues'

const STORAGE_KEY = 'respondo-issues'

const seedById = new Map(seedIssues.map((i) => [i.id, i]))

const DEFAULT_DOCK: SecurityManualDock = {
  section_trail: ['Security manual', 'Unindexed'],
  snippet:
    'No security manual excerpt is on file for this issue. Ingest chunks from the vector index to populate routing guidance.',
  contact_department: 'Operations',
}

function normalizeDock(raw: unknown, fallback: SecurityManualDock): SecurityManualDock {
  if (!raw || typeof raw !== 'object') return fallback
  const d = raw as Record<string, unknown>
  const trail = d.section_trail
  return {
    section_trail: Array.isArray(trail)
      ? trail.filter((x): x is string => typeof x === 'string')
      : fallback.section_trail,
    snippet: typeof d.snippet === 'string' ? d.snippet : fallback.snippet,
    contact_department:
      typeof d.contact_department === 'string'
        ? d.contact_department
        : fallback.contact_department,
  }
}

function normalizeIssue(raw: unknown): Issue | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Issue> & { id?: string }
  if (!r.id) return null
  const seed = seedById.get(r.id)
  const dockFallback = seed?.security_manual_dock ?? DEFAULT_DOCK
  return {
    id: r.id,
    title: typeof r.title === 'string' ? r.title : (seed?.title ?? 'Untitled'),
    date: typeof r.date === 'string' ? r.date : (seed?.date ?? ''),
    time: typeof r.time === 'string' ? r.time : (seed?.time ?? ''),
    description:
      typeof r.description === 'string'
        ? r.description
        : (seed?.description ?? ''),
    status:
      r.status === 'unresolved' ||
      r.status === 'resolved' ||
      r.status === 'incorrectly_classified'
        ? r.status
        : (seed?.status ?? 'unresolved'),
    security_manual_dock: normalizeDock(r.security_manual_dock, dockFallback),
    reason_flagged:
      typeof r.reason_flagged === 'string'
        ? r.reason_flagged
        : (seed?.reason_flagged ??
          'Legacy record: agent flag reason was not stored.'),
  }
}

function load(): Issue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedIssues
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return seedIssues
    const merged = parsed
      .map(normalizeIssue)
      .filter((x): x is Issue => x !== null)
    return merged.length > 0 ? merged : seedIssues
  } catch {
    return seedIssues
  }
}

function persist(issues: Issue[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues))
}

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>(() => load())

  useEffect(() => {
    persist(issues)
  }, [issues])

  const setStatus = useCallback((id: string, status: IssueStatus) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status } : i)),
    )
  }, [])

  const removeIssue = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return { issues, setStatus, removeIssue }
}
