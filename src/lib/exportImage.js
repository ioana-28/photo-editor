import { renderToCanvas } from './pipeline'
import { triggerDownload } from './presetIO'

/**
 * Render at FULL resolution and download. Same params/pipeline as the preview,
 * so the exported file matches what was on screen.
 */
export async function exportImage({
  fullBitmap,
  params,
  format = 'image/jpeg',
  quality = 0.92,
  filename = 'edited-photo.jpg',
}) {
  const canvas = renderToCanvas(fullBitmap, params)
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, format, quality),
  )
  if (!blob) throw new Error('Could not encode the image.')
  triggerDownload(blob, ensureExtension(filename, format))
}

function ensureExtension(name, format) {
  const ext = format === 'image/png' ? 'png' : 'jpg'
  const base = name.replace(/\.[^./\\]+$/, '') || 'edited-photo'
  return `${base}.${ext}`
}
