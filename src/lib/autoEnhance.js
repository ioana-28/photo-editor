import { clamp, neutralParams } from './filters'

const CHIP_META = {
  'too dark': { icon: '☀️', label: 'Brighten' },
  'too bright': { icon: '🌙', label: 'Darken' },
  flat: { icon: '◐', label: 'Add contrast' },
  'cool cast': { icon: '🧊', label: 'Warm it up' },
  'warm cast': { icon: '🔥', label: 'Cool it down' },
  'washed out': { icon: '🎨', label: 'Add color' },
  oversaturated: { icon: '🌈', label: 'Tone colors down' },
  'crushed blacks': { icon: '⬛', label: 'Lift shadows' },
  'blown highlights': { icon: '⬜', label: 'Recover highlights' },
  soft: { icon: '🔎', label: 'Add sharpness' },
}

export function suggestionsFromAnalysis(analysis) {
  if (!analysis?.assessment) return []
  return analysis.assessment
    .map((a) => {
      const params = fixFor(a.status, analysis)
      const meta = CHIP_META[a.status] ?? { icon: '✨', label: a.status }
      return {
        id: a.status,
        status: a.status,
        property: a.property,
        label: `${meta.label}`,
        icon: meta.icon,
        reason: a.reason,
        params,
      }
    })
    .filter((s) => s.params)
}

// Conservative, measured corrections. Each magnitude scales with how far off
// the photo is, then is clamped to a small cap so Auto never overdoes it.
function fixFor(status, m) {
  switch (status) {
    case 'too dark': {
      const deficit = clamp(0.5 - m.brightness.median, 0, 0.4)
      return {
        ...neutralParams(),
        brightness: clamp(deficit * 0.9, 0, 0.3),
        shadows: clamp(deficit * 0.6, 0, 0.2),
      }
    }
    case 'too bright': {
      const excess = clamp(m.brightness.median - 0.5, 0, 0.4)
      return {
        ...neutralParams(),
        brightness: clamp(-excess * 0.7, -0.25, 0),
        highlights: clamp(-excess * 0.8, -0.3, 0),
      }
    }
    case 'flat': {
      const deficit = clamp(0.7 - m.contrast.range, 0, 0.4)
      return { ...neutralParams(), contrast: clamp(deficit * 0.7, 0, 0.25) }
    }
    case 'cool cast': {
      return {
        ...neutralParams(),
        warmth: clamp(m.color.castStrength * 1.5, 0, 0.28),
      }
    }
    case 'warm cast': {
      return {
        ...neutralParams(),
        warmth: clamp(-m.color.castStrength * 1.5, -0.28, 0),
      }
    }
    case 'washed out': {
      const deficit = clamp(0.35 - m.saturation.mean, 0, 0.35)
      return {
        ...neutralParams(),
        vibrance: clamp(deficit * 1.4, 0, 0.3),
        saturation: clamp(deficit * 0.7, 0, 0.2),
      }
    }
    case 'oversaturated': {
      const excess = clamp(m.saturation.mean - 0.4, 0, 0.3)
      return { ...neutralParams(), saturation: clamp(-excess * 0.9, -0.25, 0) }
    }
    case 'crushed blacks':
      return { ...neutralParams(), shadows: 0.28, fade: 0.1 }
    case 'blown highlights':
      return { ...neutralParams(), highlights: -0.3 }
    case 'soft':
      return { ...neutralParams(), sharpen: 0.3 }
    default:
      return null
  }
}

// Apply every confident fix at once (the "Auto Enhance" button). The result is
// summed then clamped to deliberately conservative caps.
export function autoEnhanceParams(analysis) {
  const suggestions = suggestionsFromAnalysis(analysis)
  const merged = neutralParams()
  for (const s of suggestions) {
    for (const k of Object.keys(merged)) {
      merged[k] += s.params[k] ?? 0
    }
  }
  merged.brightness = clamp(merged.brightness, -0.4, 0.4)
  merged.contrast = clamp(merged.contrast, -0.35, 0.35)
  merged.saturation = clamp(merged.saturation, -0.35, 0.35)
  merged.vibrance = clamp(merged.vibrance, -0.3, 0.3)
  merged.warmth = clamp(merged.warmth, -0.35, 0.35)
  merged.shadows = clamp(merged.shadows, -0.35, 0.35)
  merged.highlights = clamp(merged.highlights, -0.35, 0.35)
  merged.fade = clamp(merged.fade, 0, 0.2)
  merged.sharpen = clamp(merged.sharpen, 0, 0.35)
  return merged
}
