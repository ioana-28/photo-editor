import { describe, it, expect } from 'vitest'
import { deltaToParams } from './referenceMatch.js'

describe('deltaToParams (deterministic before/after fallback)', () => {
  it('positive lightness delta brightens', () => {
    expect(deltaToParams({ dL: 20 }).brightness).toBeGreaterThan(0)
  })

  it('negative lightness delta darkens', () => {
    expect(deltaToParams({ dL: -20 }).brightness).toBeLessThan(0)
  })

  it('positive b delta warms', () => {
    expect(deltaToParams({ db: 10 }).warmth).toBeGreaterThan(0)
  })

  it('more lightness spread adds contrast', () => {
    const p = deltaToParams({ dLstd: 10, LstdBefore: 20 })
    expect(p.contrast).toBeCloseTo(0.25)
  })

  it('more chroma adds saturation', () => {
    const p = deltaToParams({ chromaBefore: 20, chromaAfter: 30 })
    expect(p.saturation).toBeCloseTo(0.275)
  })

  it('clamps extreme deltas to safe ranges', () => {
    const p = deltaToParams({
      dL: 999,
      db: 999,
      da: 999,
      dLstd: 999,
      LstdBefore: 1,
      chromaBefore: 1,
      chromaAfter: 1000,
    })
    expect(p.brightness).toBe(0.45)
    expect(p.warmth).toBe(0.4)
    expect(p.hue).toBe(22)
    expect(p.contrast).toBe(0.4)
    expect(p.saturation).toBe(0.4)
  })

  it('returns neutral params for an empty delta', () => {
    const p = deltaToParams({})
    expect(p.brightness).toBe(0)
    expect(p.contrast).toBe(0)
    expect(p.warmth).toBe(0)
    expect(p.saturation).toBe(0)
  })
})
