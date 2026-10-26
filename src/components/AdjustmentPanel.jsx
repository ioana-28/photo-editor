import Slider from './Slider'

const signed = (v) => {
  const pct = Math.round(v * 100)
  return pct > 0 ? `+${pct}` : `${pct}`
}
const percent = (v) => `${Math.round(v * 100)}`

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: -1, max: 1, format: signed },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1, format: signed },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1, format: signed },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1, format: signed },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1, format: signed },
  { key: 'vibrance', label: 'Vibrance', min: -1, max: 1, format: signed },
  { key: 'warmth', label: 'Warmth', min: -1, max: 1, format: signed },
  { key: 'hue', label: 'Hue', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
  { key: 'fade', label: 'Fade', min: 0, max: 1, format: percent },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, format: percent },
  { key: 'grain', label: 'Grain', min: 0, max: 1, format: percent },
  { key: 'sharpen', label: 'Sharpness', min: 0, max: 1, format: percent },
]

export default function AdjustmentPanel({ manual, onChange, onReset, disabled }) {
  return (
    <div className="panel-section">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 className="panel-title" style={{ margin: 0 }}>
          Adjustments
        </h3>
        <button
          className="btn ghost small"
          onClick={onReset}
          disabled={disabled}
        >
          Reset
        </button>
      </div>
      {ADJUSTMENTS.map((a) => (
        <Slider
          key={a.key}
          label={a.label}
          value={manual[a.key] ?? 0}
          min={a.min}
          max={a.max}
          step={a.step ?? 0.01}
          format={a.format}
          modified={Math.abs(manual[a.key] ?? 0) > 1e-4}
          onChange={(v) => onChange(a.key, v)}
        />
      ))}
    </div>
  )
}
