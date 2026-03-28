import { useCallback, useEffect, useId, useState } from 'react'

const PY_API_BASE =
  import.meta.env.VITE_VIDEO_API_URL?.replace(/\/$/, '') ?? '/api/py'

const STORAGE_KEY = 'respondo-outbound-phones'

function loadPhones(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function savePhones(numbers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(numbers))
}

type CallResponse = Record<string, unknown> & {
  detail?: unknown
}

function formatDetail(detail: unknown): string {
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

export function CallPhonesPage() {
  const inputId = useId()
  const [numbers, setNumbers] = useState<string[]>(() => loadPhones())
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<CallResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    savePhones(numbers)
  }, [numbers])

  const addNumber = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    setNumbers((prev) => [...prev, t])
    setDraft('')
  }, [draft])

  const removeAt = useCallback((index: number) => {
    setNumbers((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const startCall = useCallback(async () => {
    if (numbers.length === 0) {
      setError('Add at least one phone number.')
      return
    }
    setError(null)
    setLastResult(null)
    setLoading(true)
    try {
      const res = await fetch(`${PY_API_BASE}/api/bland/outbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: numbers[0] }),
      })
      let data: CallResponse
      try {
        data = (await res.json()) as CallResponse
      } catch {
        setError(`Bad response (${res.status})`)
        return
      }
      if (!res.ok) {
        setError(formatDetail(data.detail ?? data))
        return
      }
      setLastResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [numbers])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Outbound calls</h1>
        <p className="page-lead">
          Add numbers below; the Call button starts one Bland.ai outbound call to the first number
          only (<code className="inline-code">POST /api/bland/outbound-call</code>).
        </p>
      </div>

      <section className="settings-panel" aria-labelledby="phones-heading">
        <h2 id="phones-heading" className="settings-panel-title">
          Phone numbers
        </h2>
        <form
          className="settings-inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            addNumber()
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            Phone number
          </label>
          <input
            id={inputId}
            className="input input--grow"
            placeholder="E.g. +14155551234"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="tel"
          />
          <button type="submit" className="btn btn--secondary">
            Add number
          </button>
        </form>

        {numbers.length === 0 ? (
          <p className="members-empty">No numbers yet. Add one or more above.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Number</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((num, i) => (
                  <tr key={`${num}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{num}</td>
                    <td className="data-table-actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => removeAt(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="call-phones-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading || numbers.length === 0}
            onClick={() => void startCall()}
          >
            {loading ? 'Calling…' : 'Call'}
          </button>
        </div>

        {error && (
          <p className="call-phones-error" role="alert">
            {error}
          </p>
        )}

        {lastResult && (
          <div className="call-phones-result" role="status">
            <p className="field-label">Last response</p>
            <pre className="call-phones-result-pre">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  )
}
