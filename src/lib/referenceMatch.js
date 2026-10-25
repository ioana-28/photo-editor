import { clamp, neutralParams } from './filters'

// Approximate "match the look of a reference photo".
// We compare LAB color statistics of the two photos and express the
// difference as knob values, so the result stays fully editable.
//
// (A true per-pixel LAB transfer is possible later as its own pipeline pass.)

const SAMPLE = 160

export function matchReference(targetBitmap, referenceBitmap) {
  const a = stats(targetBitmap)
  const b = stats(referenceBitmap)
  if (!a || !b) return neutralParams()

  const params = neutralParams()

  // Lightness -> brightness
  params.brightness = clamp((b.L - a.L) / 45, -0.45, 0.45)

  // Lightness spread -> contrast
  const ratio = a.Lstd > 1e-3 ? b.Lstd / a.Lstd : 1
  params.contrast = clamp((ratio - 1) * 0.5, -0.4, 0.4)

  // b channel (blue<->yellow) -> warmth
  params.warmth = clamp((b.b - a.b) / 22, -0.4, 0.4)

  // a channel (green<->red) -> hue nudge
  params.hue = clamp((b.a - a.a) * 1.4, -22, 22)

  // Chroma -> saturation
  const cA = Math.hypot(a.a, a.b)
  const cB = Math.hypot(b.a, b.b)
  const cRatio = cA > 1e-3 ? cB / cA : 1
  params.saturation = clamp((cRatio - 1) * 0.55, -0.4, 0.4)

  return params
}

function stats(bitmap) {
  try {
    const scale = Math.min(1, SAMPLE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const n = w * h

    let L = 0
    let a = 0
    let b = 0
    let L2 = 0
    let a2 = 0
    let b2 = 0

    for (let i = 0; i < data.length; i += 4) {
      const [l, la, lb] = rgbToLab(data[i], data[i + 1], data[i + 2])
      L += l
      a += la
      b += lb
      L2 += l * l
      a2 += la * la
      b2 += lb * lb
    }
    L /= n
    a /= n
    b /= n
    L2 /= n
    a2 /= n
    b2 /= n
    return {
      L,
      a,
      b,
      Lstd: Math.sqrt(Math.max(0, L2 - L * L)),
      astd: Math.sqrt(Math.max(0, a2 - a * a)),
      bstd: Math.sqrt(Math.max(0, b2 - b * b)),
    }
  } catch {
    return null
  }
}

// sRGB (0-255) -> CIELAB. Standard D65 conversion.
function rgbToLab(r, g, b) {
  r = srgbToLinear(r / 255)
  g = srgbToLinear(g / 255)
  b = srgbToLinear(b / 255)

  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

  x = xyzToLab(x)
  y = xyzToLab(y)
  z = xyzToLab(z)

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function xyzToLab(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
}
