import { useEffect, useRef } from 'react'
import { renderToCanvas } from '../lib/pipeline'

export default function EditorCanvas({
  bitmap,
  params,
  comparing,
  onCompareStart,
  onCompareEnd,
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!bitmap || !canvasRef.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      try {
        renderToCanvas(bitmap, params, canvasRef.current)
      } catch {
        /* ignore render errors */
      }
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [bitmap, params])

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        className="editor-canvas"
        onPointerDown={onCompareStart}
        onPointerUp={onCompareEnd}
        onPointerLeave={onCompareEnd}
        onPointerCancel={onCompareEnd}
      />
      {comparing ? <div className="compare-badge">Original</div> : null}
      <div className="stage-hint">
        {comparing ? 'Release to show the edit' : 'Press and hold to compare'}
      </div>
    </div>
  )
}
