export default function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  modified = false,
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <span className="label">{label}</span>
        <span className={`value ${modified ? 'modified' : ''}`}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => onChange(0)}
      />
    </div>
  )
}
