import PresetButton from './PresetButton'

export default function PresetGrid({
  presets,
  thumbSource,
  selectedId,
  onSelect,
  onDelete,
}) {
  return (
    <div className="panel-section">
      <h3 className="panel-title">Presets</h3>

      {!thumbSource ? (
        <p className="empty-note">Upload a photo to see presets on it.</p>
      ) : null}

      <div className="preset-grid">
        {presets.map((p) => (
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
