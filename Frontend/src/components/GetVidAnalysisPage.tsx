import { useCallback, useId, useState } from 'react'

const VIDEO_API_BASE =
  import.meta.env.VITE_VIDEO_API_URL?.replace(/\/$/, '') ?? '/api/py'

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
  return 'Request failed'
}

export function GetVidAnalysisPage() {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{
    reason_flagged_as_issue: string | null
    video_description: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = useCallback(async () => {
    if (!file) {
      setError('Choose a video file first.')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${VIDEO_API_BASE}/api/analyze-video`, {
        method: 'POST',
        body: form,
      })
      let data: {
        reason_flagged_as_issue?: string | null
        video_description?: string
        detail?: unknown
      }
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error(res.ok ? 'Invalid JSON from server' : res.statusText)
      }
      if (!res.ok) {
        const detail = formatApiDetail(data.detail) || res.statusText
        throw new Error(detail || `Request failed (${res.status})`)
      }
      if (typeof data.video_description !== 'string') {
        throw new Error('Unexpected response from server')
      }
      setResult({
        reason_flagged_as_issue:
          data.reason_flagged_as_issue === undefined ||
          data.reason_flagged_as_issue === null
            ? null
            : String(data.reason_flagged_as_issue),
        video_description: data.video_description,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [file])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Get Vid Analysis</h1>
        <p className="page-lead">
          Upload a video. Frames are sampled on the server and sent to the same
          OpenAI vision flow as the backend <code>video_agent</code> script. The
          API returns JSON: whether the footage looks like an operational issue
          (with a reason) and a short video summary.
        </p>
      </div>

      <section className="vid-analysis-panel" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="settings-panel-title">
          Upload
        </h2>
        <p className="vid-analysis-hint">
          Supported types: MP4, MOV, WebM, MKV, AVI, M4V. Start the API with{' '}
          <code>uvicorn main:app --reload</code> from the <code>Backend</code>{' '}
          folder (Vite proxies <code>/api/py</code> to port 8000 in dev).
        </p>

        <div className="vid-analysis-controls">
          <label className="sr-only" htmlFor={inputId}>
            Video file
          </label>
          <input
            id={inputId}
            className="input vid-analysis-file"
            type="file"
            accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setError(null)
              setResult(null)
            }}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading || !file}
            onClick={() => void submit()}
          >
            {loading ? 'Analyzing…' : 'Analyze video'}
          </button>
        </div>

        {file ? (
          <p className="vid-analysis-file-meta" aria-live="polite">
            Selected: <strong>{file.name}</strong> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        ) : null}

        {error ? (
          <div className="vid-analysis-error" role="alert">
            {error}
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="vid-analysis-result" aria-labelledby="result-heading">
          <h2 id="result-heading" className="settings-panel-title">
            Analysis
          </h2>
          <div className="vid-analysis-fields">
            <div className="vid-analysis-field">
              <h3 className="vid-analysis-field-label">Reason flagged as an issue</h3>
              <p className="vid-analysis-field-value">
                {result.reason_flagged_as_issue?.trim()
                  ? result.reason_flagged_as_issue
                  : 'Not flagged (no issue reason).'}
              </p>
            </div>
            <div className="vid-analysis-field">
              <h3 className="vid-analysis-field-label">Video description</h3>
              <p className="vid-analysis-field-value vid-analysis-field-value--body">
                {result.video_description}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
