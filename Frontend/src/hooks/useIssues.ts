import { useCallback, useEffect, useState } from 'react'
import { issues as seedIssues } from '../data/issues'
import type {
  Issue,
  IssueStatus,
  SecurityManualDock,
  IssueVideoPreview,
  VideoAnalysisResult,
} from '../types'

const STORAGE_KEY = 'respondo-issues'

const seedById = new Map(seedIssues.map((issue) => [issue.id, issue]))

const DEFAULT_DOCK: SecurityManualDock = {
  section_trail: ['Security manual', 'Unindexed'],
  snippet:
    'No security-manual excerpt is on file for this issue yet. Ingest vector chunks to populate department routing guidance.',
  contact_department: 'Operations',
}

function formatIncidentTypeLabel(incidentType: string): string {
  return incidentType
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0] + segment.slice(1).toLowerCase())
    .join(' ')
}

function formatDocTypeLabel(docType: string | undefined): string {
  if (!docType) return 'Manual route'
  return docType
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}

function normalizeAnalysis(
  raw: unknown,
): VideoAnalysisResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const analysis = raw as Partial<VideoAnalysisResult>
  if (
    typeof analysis.flagged !== 'boolean' ||
    typeof analysis.incident_type !== 'string' ||
    typeof analysis.summary !== 'string' ||
    typeof analysis.description !== 'string' ||
    typeof analysis.reasoning !== 'string' ||
    typeof analysis.confidence !== 'number'
  ) {
    return undefined
  }

  return {
    video_filename:
      typeof analysis.video_filename === 'string' ? analysis.video_filename : null,
    incident_id:
      typeof analysis.incident_id === 'string' ? analysis.incident_id : null,
    camera_id: typeof analysis.camera_id === 'string' ? analysis.camera_id : null,
    analysis_mode: 'gemini',
    flagged: analysis.flagged,
    incident_type: analysis.incident_type,
    severity:
      analysis.severity === 'LOW' ||
      analysis.severity === 'MEDIUM' ||
      analysis.severity === 'HIGH'
        ? analysis.severity
        : 'LOW',
    summary: analysis.summary,
    description: analysis.description,
    reasoning: analysis.reasoning,
    confidence: analysis.confidence,
    primary_department:
      typeof analysis.primary_department === 'string'
        ? analysis.primary_department
        : 'Unassigned',
    secondary_departments: Array.isArray(analysis.secondary_departments)
      ? analysis.secondary_departments.filter(
          (department): department is string => typeof department === 'string',
        )
      : [],
    recommended_actions: Array.isArray(analysis.recommended_actions)
      ? analysis.recommended_actions.filter(
          (action): action is string => typeof action === 'string',
        )
      : [],
    manual_search_query:
      typeof analysis.manual_search_query === 'string'
        ? analysis.manual_search_query
        : null,
    manual_matches: Array.isArray(analysis.manual_matches)
      ? analysis.manual_matches.filter(
          (match): match is VideoAnalysisResult['manual_matches'][number] =>
            Boolean(match) && typeof match === 'object',
        )
      : [],
    manual_index:
      analysis.manual_index && typeof analysis.manual_index === 'object'
        ? analysis.manual_index
        : null,
    sampled_frames: Array.isArray(analysis.sampled_frames)
      ? analysis.sampled_frames.filter(
          (frame): frame is VideoAnalysisResult['sampled_frames'][number] =>
            Boolean(frame) && typeof frame === 'object',
        )
      : [],
    analyzed_at:
      typeof analysis.analyzed_at === 'string'
        ? analysis.analyzed_at
        : new Date().toISOString(),
  }
}

function normalizeVideoPreview(
  raw: unknown,
): IssueVideoPreview | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const preview = raw as Partial<IssueVideoPreview>
  if (
    typeof preview.dataUrl !== 'string' ||
    typeof preview.fileName !== 'string' ||
    typeof preview.mimeType !== 'string'
  ) {
    return undefined
  }

  return {
    dataUrl: preview.dataUrl,
    fileName: preview.fileName,
    mimeType: preview.mimeType,
  }
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
    source:
      issue.source === 'video_analysis' || issue.source === 'seed'
        ? issue.source
        : seed?.source ?? 'seed',
    analysis: normalizeAnalysis(issue.analysis) ?? seed?.analysis,
    videoPreview: normalizeVideoPreview(issue.videoPreview) ?? seed?.videoPreview,
  }
}

export function loadIssues(): Issue[] {
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

export function persistIssues(issues: Issue[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues))
}

function buildIssueId(result: VideoAnalysisResult): string {
  const stableSource =
    result.incident_id?.trim() ||
    [result.camera_id, result.video_filename, result.analyzed_at]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(':') ||
    crypto.randomUUID()

  return `analysis:${stableSource.replaceAll(/\s+/g, '-').toLowerCase()}`
}

function buildIssueTitle(result: VideoAnalysisResult): string {
  const summary = result.summary.trim()
  if (summary) {
    return summary.length > 88 ? `${summary.slice(0, 85).trimEnd()}...` : summary
  }

  const incidentType = formatIncidentTypeLabel(result.incident_type)
  const context = result.camera_id ?? result.video_filename
  return context ? `${incidentType} - ${context}` : incidentType
}

function buildIssueDateTime(result: VideoAnalysisResult): {
  date: string
  time: string
} {
  const parsed = new Date(result.analyzed_at)
  const dateValue = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return {
    date: dateValue.toLocaleDateString('en-CA'),
    time: dateValue.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }
}

function buildManualDock(result: VideoAnalysisResult): SecurityManualDock {
  const topMatch = result.manual_matches[0]
  const docType =
    topMatch && typeof topMatch.metadata.doc_type === 'string'
      ? topMatch.metadata.doc_type
      : undefined
  const sectionTrail = [
    'Security manual',
    formatDocTypeLabel(docType),
    formatIncidentTypeLabel(result.incident_type),
  ]

  if (topMatch?.document) {
    sectionTrail.push(topMatch.document)
  }

  const snippet = topMatch?.content?.trim()
  if (snippet) {
    return {
      section_trail: sectionTrail,
      snippet,
      contact_department: result.primary_department,
    }
  }

  const actions =
    result.recommended_actions.length > 0
      ? `Recommended actions: ${result.recommended_actions.join(' ')}`
      : 'No manual match snippet is available for this analysis yet.'

  return {
    section_trail: sectionTrail,
    snippet: `${result.reasoning}\n\n${actions}`.trim(),
    contact_department: result.primary_department,
  }
}

export function buildIssueFromAnalysis(
  result: VideoAnalysisResult,
  videoPreview?: IssueVideoPreview,
): Issue {
  const { date, time } = buildIssueDateTime(result)

  return {
    id: buildIssueId(result),
    title: buildIssueTitle(result),
    date,
    time,
    description: result.description.trim() || result.summary.trim(),
    status: result.flagged ? 'unresolved' : 'resolved',
    reason_flagged: result.flagged
      ? result.reasoning
      : `The analysis marked this clip as non-actionable. ${result.reasoning}`,
    security_manual_dock: buildManualDock(result),
    location: result.camera_id ?? undefined,
    department: result.primary_department,
    source: 'video_analysis',
    analysis: result,
    videoPreview,
  }
}

export function upsertVideoAnalysisIssue(
  result: VideoAnalysisResult,
  videoPreview?: IssueVideoPreview,
): Issue {
  const nextIssue = buildIssueFromAnalysis(result, videoPreview)
  const current = loadIssues()
  const existing = current.find((issue) => issue.id === nextIssue.id)
  const mergedIssue: Issue = existing
    ? {
        ...nextIssue,
        classificationNote: existing.classificationNote,
        videoPreview: nextIssue.videoPreview ?? existing.videoPreview,
      }
    : nextIssue

  persistIssues([
    mergedIssue,
    ...current.filter((issue) => issue.id !== mergedIssue.id),
  ])

  return mergedIssue
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
