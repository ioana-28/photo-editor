import { describe, it, expect } from 'vitest'
import { normalizeAiResponse } from './aiSuggest.js'

describe('normalizeAiResponse', () => {
  it('keeps valid params and fills missing keys with 0', () => {
    const out = normalizeAiResponse({
      params: { brightness: 0.2, contrast: 0.1 },
      rationale: 'ok',
      confidence: 0.7,
    })
    expect(out.params.brightness).toBe(0.2)
    expect(out.params.contrast).toBe(0.1)
    expect(out.params.warmth).toBe(0)
    expect(out.params.sharpen).toBe(0)
    expect(out.rationale).toBe('ok')
    expect(out.confidence).toBe(0.7)
  })

  it('clamps out-of-range values', () => {
    const out = normalizeAiResponse({
      params: { brightness: 9, contrast: -9, hue: 999, fade: -1, sharpen: 5 },
    })
    expect(out.params.brightness).toBe(1)
    expect(out.params.contrast).toBe(-1)
    expect(out.params.hue).toBe(180)
    expect(out.params.fade).toBe(0)
    expect(out.params.sharpen).toBe(1)
  })

  it('coerces numeric strings', () => {
    const out = normalizeAiResponse({ params: { warmth: '0.25', vibrance: '-0.1' } })
    expect(out.params.warmth).toBe(0.25)
    expect(out.params.vibrance).toBe(-0.1)
  })

  it('treats non-numeric values as 0', () => {
    const out = normalizeAiResponse({
      params: { brightness: 'nope', contrast: null },
    })
    expect(out.params.brightness).toBe(0)
    expect(out.params.contrast).toBe(0)
  })

  it('handles a completely missing payload gracefully', () => {
    const out = normalizeAiResponse({})
    expect(out.params.brightness).toBe(0)
    expect(out.rationale).toBe('')
    expect(out.confidence).toBe(0)
  })
})
