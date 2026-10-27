import { describe, it, expect } from 'vitest'
import { coerceParams, parseModelJson } from './deepseek.js'

describe('parseModelJson', () => {
  it('parses a plain JSON object', () => {
    const out = parseModelJson('{"params":{},"rationale":"x","confidence":0.5}')
    expect(out.rationale).toBe('x')
  })

  it('strips ```json fences', () => {
    const out = parseModelJson('```json\n{"params":{},"rationale":"ok"}\n```')
    expect(out.rationale).toBe('ok')
  })

  it('extracts JSON embedded in surrounding text', () => {
    const out = parseModelJson('Here you go: {"params":{},"rationale":"hi"} done')
    expect(out.rationale).toBe('hi')
  })
})

describe('coerceParams', () => {
  it('fills missing keys with 0', () => {
    const p = coerceParams({ brightness: 0.2 })
    expect(p.brightness).toBe(0.2)
    expect(p.contrast).toBe(0)
    expect(p.sharpen).toBe(0)
  })

  it('coerces numeric strings', () => {
    const p = coerceParams({ brightness: '0.3', warmth: '-0.2' })
    expect(p.brightness).toBe(0.3)
    expect(p.warmth).toBe(-0.2)
  })

  it('clamps out-of-range values to the schema', () => {
    const p = coerceParams({
      brightness: 9,
      contrast: -9,
      hue: 999,
      sharpen: 5,
      fade: -1,
    })
    expect(p.brightness).toBe(1)
    expect(p.contrast).toBe(-1)
    expect(p.hue).toBe(180)
    expect(p.sharpen).toBe(1)
    expect(p.fade).toBe(0)
  })

  it('treats non-numeric values as 0', () => {
    const p = coerceParams({ brightness: 'not a number', contrast: null })
    expect(p.brightness).toBe(0)
    expect(p.contrast).toBe(0)
  })
})
