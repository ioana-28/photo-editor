import { describe, it, expect } from 'vitest'
import {
  combineParams,
  neutralParams,
  buildLut,
  toCssFilter,
} from './filters.js'
import {
  autoEnhanceParams,
  suggestionsFromAnalysis,
} from './autoEnhance.js'

const preset = {
  brightness: 0.2,
  contrast: 0.3,
  saturation: -1,
  warmth: -0.3,
  hue: 0,
  fade: 0.1,
  vignette: 0.2,
  grain: 0.1,
  sharpen: 0.1,
}

describe('combineParams (intensity blend + manual overlay)', () => {
  it('50% intensity halves the preset', () => {
    const out = combineParams(preset, neutralParams(), 0.5)
    expect(out.brightness).toBeCloseTo(0.1)
    expect(out.contrast).toBeCloseTo(0.15)
    expect(out.saturation).toBeCloseTo(-0.5)
  })

  it('0% intensity = neutral, 100% = full preset', () => {
    expect(combineParams(preset, neutralParams(), 0).brightness).toBeCloseTo(0)
    expect(combineParams(preset, neutralParams(), 1).contrast).toBeCloseTo(0.3)
  })

  it('manual adjustments add on top of the preset', () => {
    const out = combineParams(
      { ...neutralParams(), brightness: 0.3 },
      { ...neutralParams(), brightness: 0.2 },
      1,
    )
    expect(out.brightness).toBeCloseTo(0.5)
  })

  it('clamps out-of-range values', () => {
    const out = combineParams(
      { ...neutralParams(), brightness: 0.8 },
      { ...neutralParams(), brightness: 0.8 },
      1,
    )
    expect(out.brightness).toBe(1)
  })
})

describe('toCssFilter', () => {
  it('is none when neutral', () => {
    expect(toCssFilter(neutralParams())).toBe('none')
  })

  it('emits brightness/contrast/saturate for those knobs', () => {
    const s = toCssFilter({ ...neutralParams(), brightness: 0.5, saturation: 1 })
    expect(s).toContain('brightness(1.3')
    expect(s).toContain('saturate(2.0')
  })
})

describe('buildLut (fade lifts blacks)', () => {
  it('lifts pure black off zero', () => {
    const lut = buildLut({ ...neutralParams(), fade: 0.3 })
    expect(lut[0]).toBeGreaterThan(0)
    expect(lut[255]).toBeGreaterThanOrEqual(255 - 2)
  })

  it('is identity-ish when no fade', () => {
    const lut = buildLut(neutralParams())
    expect(lut[0]).toBe(0)
    expect(lut[128]).toBe(128)
  })

  it('shadows lift dark tones, highlights lift bright tones', () => {
    const shadowLut = buildLut({ ...neutralParams(), shadows: 0.5 })
    expect(shadowLut[20]).toBeGreaterThan(20)
    expect(shadowLut[240]).toBeGreaterThanOrEqual(238)

    const highlightLut = buildLut({ ...neutralParams(), highlights: 0.5 })
    expect(highlightLut[240]).toBeGreaterThanOrEqual(254)
    expect(highlightLut[10]).toBeLessThanOrEqual(12)

    const recoverLut = buildLut({ ...neutralParams(), highlights: -0.5 })
    expect(recoverLut[240]).toBeLessThan(240)
  })
})

const analysis = {
  brightness: { median: 0.26, mean: 0.3 },
  contrast: { range: 0.4, stdDev: 0.1 },
  color: { cast: 'cool', castStrength: 0.16, meanR: 0.28, meanG: 0.3, meanB: 0.44 },
  saturation: { mean: 0.2 },
  clipping: { blacks: 0.02, whites: 0 },
  sharpness: { laplacianVariance: 30, quality: 'soft' },
  assessment: [
    { property: 'brightness', status: 'too dark', value: 0.26, target: 0.5, reason: 'x' },
    { property: 'contrast', status: 'flat', value: 0.4, target: 0.7, reason: 'x' },
    { property: 'color', status: 'cool cast', value: 0.16, target: 0, reason: 'x' },
    { property: 'sharpness', status: 'soft', value: 30, target: 60, reason: 'x' },
  ],
}

describe('suggestions / auto enhance', () => {
  it('produces one explainable chip per deficiency, each with params', () => {
    const chips = suggestionsFromAnalysis(analysis)
    expect(chips).toHaveLength(4)
    const dark = chips.find((c) => c.status === 'too dark')
    expect(dark.params.brightness).toBeGreaterThan(0)
    expect(dark.reason).toBe('x')
  })

  it('returns nothing for a well-balanced photo', () => {
    expect(suggestionsFromAnalysis({ assessment: [] })).toHaveLength(0)
  })

  it('auto enhance merges and caps all fixes', () => {
    const p = autoEnhanceParams(analysis)
    expect(p.brightness).toBeGreaterThan(0)
    expect(p.contrast).toBeGreaterThan(0)
    expect(p.warmth).toBeGreaterThan(0)
    expect(p.sharpen).toBeGreaterThan(0)
    expect(p.brightness).toBeLessThanOrEqual(0.4)
    expect(p.contrast).toBeLessThanOrEqual(0.35)
    expect(p.sharpen).toBeLessThanOrEqual(0.35)
  })

  it('uses shadows / highlights / vibrance for the relevant statuses', () => {
    const dark = suggestionsFromAnalysis(analysis).find(
      (c) => c.status === 'too dark',
    )
    expect(dark.params.shadows).toBeGreaterThan(0)

    const washed = suggestionsFromAnalysis({
      ...analysis,
      assessment: [
        { property: 'saturation', status: 'washed out', value: 0.1, target: 0.35, reason: 'x' },
      ],
    })[0]
    expect(washed.params.vibrance).toBeGreaterThan(0)

    const blown = suggestionsFromAnalysis({
      ...analysis,
      assessment: [
        { property: 'highlights', status: 'blown highlights', value: 0.2, target: 0.02, reason: 'x' },
      ],
    })[0]
    expect(blown.params.highlights).toBeLessThan(0)
  })
})
