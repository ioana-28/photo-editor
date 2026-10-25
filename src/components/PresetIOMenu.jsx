import { useRef } from 'react'
import { downloadPresetsFile, readPresetsFile } from '../lib/presetIO'

export default function PresetIOMenu({
  userPresets,
  allPresets,
  canSave,
  onSave,
  onImport,
  disabled,
}) {
  const inputRef = useRef(null)

  const handleSave = () => {
    const name = window.prompt('Name for this preset:', 'My Look')
    if (name === null) return
    onSave(name)
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">My Presets</h3>
      <div className="row wrap">
        <button
          className="btn small"
          onClick={handleSave}
          disabled={!canSave || disabled}
        >
          Save current
        </button>
        <button
          className="btn small"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Import
        </button>
        <button
          className="btn small"
          onClick={() => downloadPresetsFile(userPresets, 'my-presets.json')}
          disabled={!userPresets.length}
        >
          Export mine
        </button>
        <button
          className="btn small ghost"
          onClick={() => downloadPresetsFile(allPresets, 'presets.json')}
        >
          Export all
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden-input"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const list = await readPresetsFile(file)
              onImport(list)
            } catch (err) {
              window.alert(err.message || 'Could not read that preset file.')
            }
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
