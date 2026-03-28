export type IssueStatus =
  | 'unresolved'
  | 'resolved'
  | 'incorrectly_classified'

export type IssueSource = 'seed' | 'video_analysis'

export type IssueVideoPreview = {
  dataUrl: string
  fileName: string
  mimeType: string
}

export type SecurityManualDock = {
  section_trail: string[]
  snippet: string
  contact_department: string
}

export type IssueChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

export type ManualMatch = {
  id: string
  distance: number
  content: string
  document: string | null
  metadata: Record<string, string | number | boolean | null>
}

export type ManualIndexResult = {
  collection_name: string
  docs_directory: string
  docs_indexed: number
  chunks_indexed: number
  reindexed: boolean
  manifest_path: string
  supported_extensions: string[]
}

export type VideoAnalysisFrame = {
  timestamp_seconds: number
  frame_index: number
}

export type VideoAnalysisResult = {
  video_filename: string | null
  incident_id: string | null
  camera_id: string | null
  analysis_mode: 'gemini'
  flagged: boolean
  incident_type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  summary: string
  description: string
  reasoning: string
  confidence: number
  primary_department: string
  secondary_departments: string[]
  recommended_actions: string[]
  manual_search_query: string | null
  manual_matches: ManualMatch[]
  manual_index: ManualIndexResult | null
  sampled_frames: VideoAnalysisFrame[]
  analyzed_at: string
}

export type Issue = {
  id: string
  title: string
  date: string
  time: string
  description: string
  status: IssueStatus
  security_manual_dock: SecurityManualDock
  reason_flagged: string
  location?: string
  department?: string
  classificationNote?: string
  source?: IssueSource
  analysis?: VideoAnalysisResult
  videoPreview?: IssueVideoPreview
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

/** Markdown report produced by the Report generation agent (stored locally). */
export type IssueReportAsset = {
  id: string
  issueId: string
  issueTitle: string
  createdAt: string
  markdown: string
}
