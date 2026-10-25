import { useRef } from 'react'

export default function ImageUploader({ onFile, dragActive, error }) {
  const inputRef = useRef(null)

  const handleFiles = (files) => {
    const file = files?.[0]
    if (file && onFile) onFile(file)
  }

  return (
    <div className="stage">
      <div className={`dropzone ${dragActive ? 'drag' : ''}`}>
        <h2>Drop a photo here</h2>
        <p>
          Edit your photo with one-click presets and smart, explainable
          adjustments — all in your browser.
        </p>
        <button className="btn primary" onClick={() => inputRef.current?.click()}>
          Choose a photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden-input"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="formats">Supports JPEG, PNG, WebP and more</div>
        {error ? (
          <div className="formats" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
