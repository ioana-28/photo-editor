import { describe, it, expect } from 'vitest'
import { normalizeReferenceResponse } from './aiReference.js'

describe('normalizeReferenceResponse', () => {
  it('keeps valid params, fills missing keys, keeps editSummary', () => {
    const out = normalizeReferenceResponse({
      params: { brightness: 0.2, warmth: 0.1 },
      editSummary: 'Warmed the light and lifted shadows.',
      rationale: 'ok',
      confidence: 0.6,
    })
    expect(out.params.brightness).toBe(0.2)
    expect(out.params.warmth).toBe(0.1)
    expect(out.params.contrast).toBe(0)
    expect(out.editSummary).toBe('Warmed the light and lifted shadows.')
    expect(out.rationale).toBe('ok')
    expect(out.confidence).toBe(0.6)
  })

  it('clamps out-of-range values and confidence', () => {
    const out = normalizeReferenceResponse({
      params: { brightness: 9, contrast: -9, hue: 999, sharpen: 5 },
      confidence: 5,
    })
    expect(out.params.brightness).toBe(1)
    expect(out.params.contrast).toBe(-1)
    expect(out.params.hue).toBe(180)
    expect(out.params.sharpen).toBe(1)
    expect(out.confidence).toBe(1)
  })

  it('coerces numeric strings and defaults non-numeric to 0', () => {
    const out = normalizeReferenceResponse({
      params: { warmth: '0.25', brightness: 'nope', contrast: null },
    })
    expect(out.params.warmth).toBe(0.25)
    expect(out.params.brightness).toBe(0)
    expect(out.params.contrast).toBe(0)
  })

  it('handles a missing payload gracefully', () => {
    const out = normalizeReferenceResponse({})
    expect(out.params.brightness).toBe(0)
    expect(out.editSummary).toBe('')
    expect(out.rationale).toBe('')
    expect(out.confidence).toBe(0)
  })

  it('ignores a non-string editSummary', () => {
    const out = normalizeReferenceResponse({ editSummary: 42 })
    expect(out.editSummary).toBe('')
  })
})
