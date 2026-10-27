import { useRef, useState } from 'react'
import { loadImageFile, revokeImage } from '../lib/imageLoader'
import { aiReferenceSuggest } from '../lib/aiReference'
import { editParamsFromPair } from '../lib/referenceMatch'

export default function AiReference({ currentBitmap, onApply, disabled }) {
  const beforeInput = useRef(null)
  const afterInput = useRef(null)
  const [before, setBefore] = useState(null)
  const [after, setAfter] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const pick = async (file, which) => {
    if (!file) return
    setError('')
    try {
      const loaded = await loadImageFile(file)
      if (which === 'before') {
        if (before) revokeImage(before)
        setBefore(loaded)
      } else {
        if (after) revokeImage(after)
        setAfter(loaded)
      }
    } catch (e) {
      setError(e.message || 'Could not load that image.')
    }
  }

  const ready = Boolean(currentBitmap && before?.preview && after?.preview)

  const run = async () => {
    if (!ready || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await aiReferenceSuggest({
        currentBitmap,
        beforeBitmap: before.preview,
        afterBitmap: after.preview,
      })
      onApply(res.params)
      setResult({ ...res, fallback: false })
    } catch (e) {
      // Deterministic offline fallback: apply the measured edit delta.
      try {
        const params = editParamsFromPair(before.preview, after.preview)
        onApply(params)
        setResult({
          editSummary: '',
          rationale: '',
          confidence: 0,
          fallback: true,
        })
        setError(`${e.message} Applied an offline color/tone match instead.`)
      } catch {
        setError(e.message || 'Reference analysis failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">AI Reference Look</h3>
      <p className="empty-note" style={{ marginTop: 0 }}>
        Upload the same reference photo before and after editing.
      </p>

      <div className="row wrap" style={{ marginBottom: 6 }}>
        <button
          className="btn small"
          onClick={() => beforeInput.current?.click()}
          disabled={disabled || loading}
        >
          Reference original
        </button>
        <span className="chip-status">{before?.name ?? 'not set'}</span>
      </div>

      <div className="row wrap" style={{ marginBottom: 10 }}>
        <button
          className="btn small"
          onClick={() => afterInput.current?.click()}
          disabled={disabled || loading}
        >
          Reference edited
        </button>
        <span className="chip-status">{after?.name ?? 'not set'}</span>
      </div>

      <input
        ref={beforeInput}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => {
          pick(e.target.files?.[0], 'before')
          e.target.value = ''
        }}
      />
      <input
        ref={afterInput}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => {
          pick(e.target.files?.[0], 'after')
          e.target.value = ''
        }}
      />

      <button
        className="btn primary small"
        onClick={run}
        disabled={!ready || loading || disabled}
      >
        {loading ? 'Analysing…' : 'Apply reference look'}
      </button>

      <p className="empty-note" style={{ marginTop: 8, marginBottom: 0 }}>
        Sends downscaled copies of 3 photos to DeepSeek. Falls back to an
        offline match if unavailable.
      </p>

      {error ? (
        <div
          className="chip-status"
          style={{ color: result?.fallback ? 'var(--text-dim)' : 'var(--danger)' }}
        >
          {error}
        </div>
      ) : null}

      {result && !result.fallback ? (
        <div className="chip-status" style={{ marginTop: 8 }}>
          {result.editSummary ? (
            <div>
              <strong>Edit:</strong> {result.editSummary}
            </div>
          ) : null}
          {result.rationale ? <div>{result.rationale}</div> : null}
          {result.confidence ? (
            <div>confidence {Math.round(result.confidence * 100)}%</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
