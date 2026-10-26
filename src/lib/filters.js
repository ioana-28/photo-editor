// The universal "knobs" that presets, sliders, auto-enhance, reference-match
// and (later) AI all write into. Keep this the single source of truth.

export const NEUTRAL_PARAMS = {
  brightness: 0,
  contrast: 0,
  shadows: 0,
  highlights: 0,
  saturation: 0,
  vibrance: 0,
  warmth: 0,
  hue: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0,
}

export const PARAM_KEYS = Object.keys(NEUTRAL_PARAMS)

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

export function neutralParams() {
  return { ...NEUTRAL_PARAMS }
}

export function scaleParams(p, t) {
  const out = {}
  for (const k of PARAM_KEYS) out[k] = (p?.[k] ?? 0) * t
  return out
}

export function addParams(a, b) {
  const out = {}
  for (const k of PARAM_KEYS) out[k] = (a?.[k] ?? 0) + (b?.[k] ?? 0)
  return out
}

export function clampParams(p) {
  return {
    brightness: clamp(p.brightness ?? 0, -1, 1),
    contrast: clamp(p.contrast ?? 0, -1, 1),
    shadows: clamp(p.shadows ?? 0, -1, 1),
    highlights: clamp(p.highlights ?? 0, -1, 1),
    saturation: clamp(p.saturation ?? 0, -1, 1),
    vibrance: clamp(p.vibrance ?? 0, -1, 1),
    warmth: clamp(p.warmth ?? 0, -1, 1),
    hue: clamp(p.hue ?? 0, -180, 180),
    fade: clamp(p.fade ?? 0, 0, 1),
    vignette: clamp(p.vignette ?? 0, 0, 1),
    grain: clamp(p.grain ?? 0, 0, 1),
    sharpen: clamp(p.sharpen ?? 0, 0, 1),
  }
}

/**
 * The effective look = preset (scaled by intensity) + manual adjustments.
 */
export function combineParams(presetParams, manualParams, intensity) {
  return clampParams(addParams(scaleParams(presetParams, intensity), manualParams))
}

export function isNeutralParams(p) {
  return PARAM_KEYS.every((k) => Math.abs(p?.[k] ?? 0) < 1e-4)
}

/**
 * Build a CSS `filter` string for the parts of the model that ctx.filter can do.
 * brightness / contrast / saturation / hue are applied here; warmth, fade,
 * vignette, grain and sharpen are separate canvas passes (see pipeline.js).
 */
export function toCssFilter(p) {
  const parts = []
  if (Math.abs(p.brightness ?? 0) > 1e-4)
    parts.push(`brightness(${(1 + p.brightness * 0.6).toFixed(4)})`)
  if (Math.abs(p.contrast ?? 0) > 1e-4)
    parts.push(`contrast(${(1 + p.contrast * 0.6).toFixed(4)})`)
  if (Math.abs(p.saturation ?? 0) > 1e-4)
    parts.push(`saturate(${(1 + p.saturation).toFixed(4)})`)
  if (Math.abs(p.hue ?? 0) > 1e-4) parts.push(`hue-rotate(${p.hue.toFixed(2)}deg)`)
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * Build a 256-entry tone lookup table combining fade, shadows and highlights.
 * Applied per channel after the base draw. Shadows target the dark end,
 * highlights target the bright end, each with a smooth falloff.
 */
export function buildLut(p) {
  const fade = clamp(p.fade ?? 0, 0, 1)
  const shadows = clamp(p.shadows ?? 0, -1, 1)
  const highlights = clamp(p.highlights ?? 0, -1, 1)
  const lift = fade * 0.18
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    let v = i / 255
    // fade lifts the black point
    v = lift + v * (1 - lift)
    // shadows: strongest at the darkest tones
    const shadowWeight = (1 - v) * (1 - v)
    v += shadows * 0.3 * shadowWeight
    // highlights: strongest at the brightest tones
    const highlightWeight = v * v
    v += highlights * 0.3 * highlightWeight
    lut[i] = clamp(v, 0, 1) * 255
  }
  return lut
}

export function toneNeeded(p) {
  return (
    (p.fade ?? 0) > 1e-4 ||
    Math.abs(p.shadows ?? 0) > 1e-4 ||
    Math.abs(p.highlights ?? 0) > 1e-4
  )
}
