import { useId, useState } from 'react'
import type { VideoAnalysisResult } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_VIDEO_API_URL?.replace(/\/$/, '') ||
  'http://localhost:8000'

function formatApiDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item !== null && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item),
      )
      .join(' ')
  }
  return 'Backend request failed.'
}

function buildEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, '')
  return trimmed.endsWith('/api/py')
    ? `${trimmed}/api/analyze-video`
    : `${trimmed}/api/analyze-video`
}

export function GetVidAnalysisPage() {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [incidentId, setIncidentId] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Video analysis</h1>
        <p className="page-lead">
          Upload footage and send it to the backend FastAPI service for
          frame-based incident analysis.
        </p>
      </div>

      <section className="analysis-layout">
        <form
          className="analysis-card"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!file) {
              setError('Choose a video before running the analysis.')
              return
            }

            const formData = new FormData()
            formData.append('video', file)
            if (incidentId.trim()) formData.append('incident_id', incidentId)
            if (cameraId.trim()) formData.append('camera_id', cameraId)

            setLoading(true)
            setError(null)

            try {
              const response = await fetch(buildEndpoint(API_BASE_URL), {
                method: 'POST',
                body: formData,
              })

              const payload = (await response.json()) as
                | VideoAnalysisResult
                | { detail?: unknown }

              if (!response.ok) {
                const detail =
                  'detail' in payload ? formatApiDetail(payload.detail) : undefined
                throw new Error(detail ?? 'Backend request failed.')
              }

              setResult(payload as VideoAnalysisResult)
            } catch (requestError) {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : 'Unexpected analysis error.',
              )
            } finally {
              setLoading(false)
            }
          }}
        >
          <div className="analysis-card-header">
            <div>
              <p className="panel-eyebrow">Backend upload form</p>
              <h2 className="panel-title">Analyze video</h2>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Incident ID</span>
            <input
              className="input"
              placeholder="incident-123"
              value={incidentId}
              onChange={(event) => setIncidentId(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Camera ID</span>
            <input
              className="input"
              placeholder="north-lobby-04"
              value={cameraId}
              onChange={(event) => setCameraId(event.target.value)}
            />
          </label>

          <label className="field" htmlFor={inputId}>
            <span className="field-label">Video file</span>
            <input
              id={inputId}
              className="input input--file"
              type="file"
              accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
              onChange={(event) => setFile(event.target.files?.item(0) ?? null)}
            />
          </label>

          {file ? (
            <p className="field-value">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Analyzing…' : 'Run analysis'}
          </button>

          {error ? <p className="inline-error">{error}</p> : null}
        </form>

        <section className="analysis-card">
          <div className="analysis-card-header">
            <div>
              <p className="panel-eyebrow">Structured result</p>
              <h2 className="panel-title">Latest response</h2>
            </div>
          </div>

          {result ? (
            <div className="analysis-result">
              <div className="analysis-summary-row">
                <span
                  className={`issue-tag ${result.flagged ? 'issue-tag--unresolved' : 'issue-tag--resolved'}`}
                >
                  {result.flagged ? 'Flagged' : 'Not flagged'}
                </span>
                <span className="shell-pill">{result.severity}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <p className="field-label">Incident type</p>
                  <p className="field-value">{result.incident_type}</p>
                </div>
                <div>
                  <p className="field-label">Primary department</p>
                  <p className="field-value">{result.primary_department}</p>
                </div>
              </div>

              <div>
                <p className="field-label">Summary</p>
                <p className="issue-description">{result.summary}</p>
              </div>

              <div>
                <p className="field-label">Reasoning</p>
                <p className="issue-description">{result.reasoning}</p>
              </div>

              <div>
                <p className="field-label">Recommended actions</p>
                <ul className="compact-list">
                  {result.recommended_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="field-label">Manual matches</p>
                {result.manual_matches.length === 0 ? (
                  <p className="field-value">No manual matches returned.</p>
                ) : (
                  <ul className="compact-list">
                    {result.manual_matches.map((match) => (
                      <li key={match.id}>
                        <strong>{match.id}</strong>: {match.content}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="field-value">
              No analysis yet. Submit a clip to populate this panel.
            </p>
          )}
        </section>
      </section>
    </div>
  )
}
