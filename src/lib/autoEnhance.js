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

function fixFor(status, m) {
  switch (status) {
    case 'too dark': {
      const deficit = 0.5 - m.brightness.median
      return { ...neutralParams(), brightness: clamp(deficit * 1.3, 0, 0.5) }
    }
    case 'too bright': {
      const excess = m.brightness.median - 0.5
      return { ...neutralParams(), brightness: clamp(-excess * 1.1, -0.45, 0) }
    }
    case 'flat': {
      const deficit = 0.7 - m.contrast.range
      return { ...neutralParams(), contrast: clamp(deficit * 0.9, 0, 0.4) }
    }
    case 'cool cast': {
      return { ...neutralParams(), warmth: clamp(m.color.castStrength * 2, 0, 0.4) }
    }
    case 'warm cast': {
      return { ...neutralParams(), warmth: clamp(-m.color.castStrength * 2, -0.4, 0) }
    }
    case 'washed out': {
      const deficit = 0.35 - m.saturation.mean
      return { ...neutralParams(), saturation: clamp(deficit * 1.5, 0, 0.4) }
    }
    case 'oversaturated': {
      const excess = m.saturation.mean - 0.4
      return { ...neutralParams(), saturation: clamp(-excess * 1.2, -0.35, 0) }
    }
    case 'crushed blacks':
      return { ...neutralParams(), fade: 0.18, brightness: 0.06 }
    case 'blown highlights':
      return { ...neutralParams(), brightness: -0.12, contrast: -0.05 }
    case 'soft':
      return { ...neutralParams(), sharpen: 0.4 }
    default:
      return null
  }
}

// Apply every confident fix at once (the "Auto Enhance" button).
export function autoEnhanceParams(analysis) {
  const suggestions = suggestionsFromAnalysis(analysis)
  const merged = neutralParams()
  for (const s of suggestions) {
    for (const k of Object.keys(merged)) {
      merged[k] += s.params[k] ?? 0
    }
  }
  merged.brightness = clamp(merged.brightness, -0.6, 0.6)
  merged.contrast = clamp(merged.contrast, -0.5, 0.5)
  merged.saturation = clamp(merged.saturation, -0.5, 0.5)
  merged.warmth = clamp(merged.warmth, -0.5, 0.5)
  merged.fade = clamp(merged.fade, 0, 0.35)
  merged.sharpen = clamp(merged.sharpen, 0, 0.5)
  return merged
}
