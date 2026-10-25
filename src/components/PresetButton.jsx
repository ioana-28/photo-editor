import { useEffect, useRef } from 'react'
import { renderToCanvas } from '../lib/pipeline'
import { combineParams, neutralParams } from '../lib/filters'

export default function PresetButton({
  preset,
  thumbSource,
  selected,
  onSelect,
  onDelete,
  canDelete,
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!thumbSource || !ref.current) return
    const params = combineParams(
      preset.params,
      neutralParams(),
      preset.defaultIntensity ?? 1,
    )
    try {
      renderToCanvas(thumbSource, params, ref.current)
    } catch {
      /* ignore thumbnail render errors */
    }
  }, [thumbSource, preset])

  return (
    <div
      className={`preset-card ${selected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(preset.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(preset.id)}
    >
      <canvas ref={ref} className="thumb" />
      <div className="meta">
        <div className="name">{preset.name}</div>
        {preset.tags?.length ? (
          <div className="tags">{preset.tags.join(' · ')}</div>
        ) : null}
      </div>
      {canDelete ? (
        <button
          className="delete"
          title="Delete preset"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(preset.id)
          }}
        >
          Delete
        </button>
      ) : null}
    </div>
  )
}
