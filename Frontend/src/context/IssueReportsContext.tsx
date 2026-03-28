/* eslint-disable react-refresh/only-export-components -- context + hook belong together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { IssueReportAsset } from '../types'

const STORAGE_KEY = 'respondo-issue-report-assets'

function load(): IssueReportAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredReport)
  } catch {
    return []
  }
}

function isStoredReport(x: unknown): x is IssueReportAsset {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.issueId === 'string' &&
    typeof r.issueTitle === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.markdown === 'string'
  )
}

function persist(reports: IssueReportAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

type IssueReportsContextValue = {
  reports: IssueReportAsset[]
  appendReport: (report: IssueReportAsset) => void
  removeReport: (id: string) => void
}

const IssueReportsContext = createContext<IssueReportsContextValue | null>(null)

export function IssueReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<IssueReportAsset[]>(() => load())

  useEffect(() => {
    persist(reports)
  }, [reports])

  const appendReport = useCallback((report: IssueReportAsset) => {
    setReports((prev) => {
      if (prev.some((r) => r.id === report.id)) return prev
      return [report, ...prev]
    })
  }, [])

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const value = useMemo(
    () => ({ reports, appendReport, removeReport }),
    [reports, appendReport, removeReport],
  )

  return (
    <IssueReportsContext.Provider value={value}>{children}</IssueReportsContext.Provider>
  )
}

export function useIssueReports(): IssueReportsContextValue {
  const ctx = useContext(IssueReportsContext)
  if (!ctx) {
    throw new Error('useIssueReports must be used within IssueReportsProvider')
  }
  return ctx
}
