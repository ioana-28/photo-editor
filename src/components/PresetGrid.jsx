import { useMemo, useState } from 'react'
import PresetButton from './PresetButton'

export default function PresetGrid({
  presets,
  thumbSource,
  selectedId,
  onSelect,
  onDelete,
}) {
  const [tag, setTag] = useState('all')

  const tags = useMemo(() => {
    const set = new Set()
    presets.forEach((p) => (p.tags ?? []).forEach((t) => set.add(t)))
    return ['all', ...[...set].sort()]
  }, [presets])

  const filtered = useMemo(
    () => (tag === 'all' ? presets : presets.filter((p) => p.tags?.includes(tag))),
    [presets, tag],
  )

  return (
    <div className="panel-section">
      <h3 className="panel-title">Presets</h3>

      {tags.length > 1 ? (
        <div className="row wrap" style={{ marginBottom: 10 }}>
          {tags.map((t) => (
            <button
              key={t}
              className={`btn small ${tag === t ? 'primary' : 'ghost'}`}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {!thumbSource ? (
        <p className="empty-note">Upload a photo to see presets on it.</p>
      ) : null}

      <div className="preset-grid">
        {filtered.map((p) => (
          <PresetButton
            key={p.id}
            preset={p}
            thumbSource={thumbSource}
            selected={p.id === selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            canDelete={p.source === 'user'}
          />
        ))}
      </div>
    </div>
  )
}
