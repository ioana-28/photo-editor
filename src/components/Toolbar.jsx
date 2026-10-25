import { useRef } from 'react'

export default function Toolbar({
  hasImage,
  busy,
  onFile,
  onAuto,
  onResetAll,
  onDownload,
  format,
  setFormat,
  canAuto,
}) {
  const inputRef = useRef(null)

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="dot" />
        Photo Editor
      </div>

      <button className="btn" onClick={() => inputRef.current?.click()}>
        Open photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      <button className="btn" onClick={onAuto} disabled={!canAuto || busy}>
        ✨ Auto Enhance
      </button>

      <button className="btn ghost" onClick={onResetAll} disabled={!hasImage}>
        Reset
      </button>

      <div className="spacer" />

      <div className="seg" title="Export format">
        <button
          className={format === 'image/jpeg' ? 'active' : ''}
          onClick={() => setFormat('image/jpeg')}
          disabled={!hasImage}
        >
          JPEG
        </button>
        <button
          className={format === 'image/png' ? 'active' : ''}
          onClick={() => setFormat('image/png')}
          disabled={!hasImage}
        >
          PNG
        </button>
      </div>

      <button
        className="btn primary"
        onClick={onDownload}
        disabled={!hasImage || busy}
      >
        {busy ? 'Working…' : 'Download'}
      </button>
    </header>
  )
}
