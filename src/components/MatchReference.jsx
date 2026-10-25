import { useRef, useState } from 'react'
import { loadImageFile } from '../lib/imageLoader'
import { matchReference } from '../lib/referenceMatch'

export default function MatchReference({ targetBitmap, onApply, disabled }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('')

  const handle = async (file) => {
    if (!file || !targetBitmap) return
    setStatus('Reading…')
    try {
      const ref = await loadImageFile(file)
      const params = matchReference(targetBitmap, ref.preview)
      onApply(params)
      setStatus('Applied — tweak with the sliders.')
    } catch {
      setStatus('Could not read that image.')
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">Match a Reference</h3>
      <p className="empty-note" style={{ marginTop: 0 }}>
        Copy the color mood of another photo.
      </p>
      <button
        className="btn small"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || !targetBitmap}
      >
        Choose reference photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {status ? (
        <div className="chip-status" style={{ marginTop: 8 }}>
          {status}
        </div>
      ) : null}
    </div>
  )
}
