import { useState } from 'react'
import { suggestParams } from '../lib/suggest'

export default function AiSuggest({ bitmap, onApply, disabled }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const run = async () => {
    if (!bitmap || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await suggestParams({ mode: 'ai', bitmap })
      onApply(res.params)
      setResult({ rationale: res.rationale, confidence: res.confidence })
    } catch (e) {
      setError(e.message || 'AI analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">AI Suggest</h3>

      <button
        className="btn primary small"
        onClick={run}
        disabled={!bitmap || loading || disabled}
      >
        {loading ? 'Thinking…' : '✨ AI Suggest'}
      </button>

      <p className="empty-note" style={{ marginTop: 8, marginBottom: 0 }}>
        Sends a downscaled copy of your photo to DeepSeek.
      </p>

      {error ? (
        <div className="chip-status" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="chip-status" style={{ marginTop: 8 }}>
          {result.rationale}
          {result.confidence
            ? ` (confidence ${Math.round(result.confidence * 100)}%)`
            : ''}
        </div>
      ) : null}
    </div>
  )
}
