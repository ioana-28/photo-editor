import { buildLut, toCssFilter, isNeutralParams } from './filters'

/**
 * The single renderer. Given a bitmap and a params object it produces a canvas.
 * Used identically for the live preview (small bitmap) and the export
 * (full-resolution bitmap), so what you see is what you download.
 *
 * Pass order: tone/levels -> base draw (ctx.filter) -> overlays
 * (warmth, fade, vignette, grain) -> sharpen.
 */
export function renderToCanvas(bitmap, params, targetCanvas) {
  const w = bitmap.width
  const h = bitmap.height
  const canvas = targetCanvas ?? document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  ctx.clearRect(0, 0, w, h)

  // 1. Base draw with CSS-filter-backed adjustments.
  ctx.filter = toCssFilter(params)
  ctx.drawImage(bitmap, 0, 0, w, h)
  ctx.filter = 'none'

  // 2. Fade (tone remap via lookup table).
  if ((params.fade ?? 0) > 1e-4) {
    const lut = buildLut(params)
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]]
      d[i + 1] = lut[d[i + 1]]
      d[i + 2] = lut[d[i + 2]]
    }
    ctx.putImageData(img, 0, 0)
  }

  // 3. Warmth / coolness (soft-light color overlay).
  if (Math.abs(params.warmth ?? 0) > 1e-4) {
    const amount = Math.min(1, Math.abs(params.warmth))
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle =
      params.warmth > 0
        ? `rgba(255, 168, 74, ${amount.toFixed(3)})`
        : `rgba(74, 150, 255, ${amount.toFixed(3)})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // 4. Sharpen (unsharp-style 3x3 kernel, if requested).
  if ((params.sharpen ?? 0) > 1e-4) {
    applySharpen(ctx, w, h, params.sharpen)
  }

  // 5. Vignette (radial darkening).
  if ((params.vignette ?? 0) > 1e-4) {
    const cx = w / 2
    const cy = h / 2
    const inner = Math.min(w, h) * 0.32
    const outer = Math.hypot(w, h) / 2
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${(params.vignette * 0.85).toFixed(3)})`)
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // 6. Grain (tiled noise, overlay blend).
  if ((params.grain ?? 0) > 1e-4) {
    applyGrain(ctx, w, h, params.grain)
  }

  return canvas
}

function applySharpen(ctx, w, h, amount) {
  const k = amount * 0.9 // kernel strength
  const img = ctx.getImageData(0, 0, w, h)
  const src = img.data
  const out = ctx.createImageData(w, h)
  const dst = out.data
  const center = 1 + 4 * k
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        dst[i] = src[i]
        dst[i + 1] = src[i + 1]
        dst[i + 2] = src[i + 2]
        dst[i + 3] = src[i + 3]
        continue
      }
      const up = i - w * 4
      const down = i + w * 4
      const left = i - 4
      const right = i + 4
      for (let c = 0; c < 3; c++) {
        const v =
          center * src[i + c] -
          k * (src[up + c] + src[down + c] + src[left + c] + src[right + c])
        dst[i + c] = v
      }
      dst[i + 3] = src[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
}

let noiseTile = null
function getNoiseTile() {
  if (noiseTile) return noiseTile
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const cx = c.getContext('2d')
  const img = cx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = 110 + Math.random() * 36
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = 255
  }
  cx.putImageData(img, 0, 0)
  noiseTile = c
  return c
}

function applyGrain(ctx, w, h, amount) {
  const tile = getNoiseTile()
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = Math.min(0.6, amount * 0.6)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

export { isNeutralParams }
