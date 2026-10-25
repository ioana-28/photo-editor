import { useMemo, useState } from 'react'
import { autoEnhanceParams, suggestionsFromAnalysis } from '../lib/autoEnhance'

export default function SuggestionChips({ analysis, onApply, onApplyAll, disabled }) {
  const [applied, setApplied] = useState(() => new Set())

  const suggestions = useMemo(
    () => suggestionsFromAnalysis(analysis),
    [analysis],
  )

  const reset = () => setApplied(new Set())

  const apply = (s) => {
    onApply(s.params)
    setApplied((prev) => new Set(prev).add(s.status))
  }

  const applyAll = () => {
    if (!suggestions.length) return
    onApplyAll(autoEnhanceParams(analysis))
    setApplied(new Set(suggestions.map((s) => s.status)))
  }

  return (
    <div className="panel-section">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          Suggestions
        </h3>
        {suggestions.length && applied.size ? (
          <button className="btn ghost small" onClick={reset} disabled={disabled}>
            Clear marks
          </button>
        ) : null}
      </div>

      {!analysis ? (
        <p className="empty-note">Analysis appears after you upload a photo.</p>
      ) : suggestions.length === 0 ? (
        <p className="empty-note">
          Looks well balanced — no corrections suggested. Try a preset.
        </p>
      ) : (
        <>
          <div className="chips">
            {suggestions.map((s) => {
              const isApplied = applied.has(s.status)
              return (
                <button
                  key={s.status}
                  className={`chip ${isApplied ? 'applied' : ''}`}
                  title={s.reason}
                  disabled={isApplied || disabled}
                  onClick={() => apply(s)}
                >
                  <span className="icon">{s.icon}</span>
                  {s.label}
                </button>
              )
            })}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary small" onClick={applyAll} disabled={disabled}>
              Apply all
            </button>
            <span className="chip-status">Click a chip to apply just that fix.</span>
          </div>
        </>
      )}
    </div>
  )
}
