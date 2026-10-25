import Slider from './Slider'

export default function IntensityControl({ value, onChange, disabled }) {
  return (
    <div className="panel-section">
      <h3 className="panel-title">Preset Intensity</h3>
      <Slider
        label="Strength"
        value={value}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  )
}
