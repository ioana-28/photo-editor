import { useMemo, useState } from 'react'
import { autoEnhanceParams, suggestionsFromAnalysis } from '../lib/autoEnhance'
import Slider from './Slider'

export default function SuggestionChips({
  analysis,
  autoIntensity,
  hasAuto,
  onApply,
  onApplyAll,
  onAutoIntensityChange,
  onResetAuto,
  disabled,
}) {
  const [applied, setApplied] = useState(() => new Set())

  const suggestions = useMemo(
    () => suggestionsFromAnalysis(analysis),
    [analysis],
  )

  const clear = () => {
    setApplied(new Set())
    onResetAuto()
  }

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
          Auto Enhance
        </h3>
        {hasAuto ? (
          <button className="btn ghost small" onClick={clear} disabled={disabled}>
            Clear
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

      <div style={{ marginTop: 16 }}>
        <Slider
          label="Correction strength"
          value={autoIntensity}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={onAutoIntensityChange}
          modified={hasAuto}
        />
      </div>
    </div>
  )
}
