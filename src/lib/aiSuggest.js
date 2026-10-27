import { clampParams, PARAM_KEYS } from './filters'

const MAX_DIM = 768
const TIMEOUT_MS = 60000

/**
 * Ask the local DeepSeek server for editing params for the current photo.
 * Sends only a downscaled JPEG preview (never the full-resolution original).
 *
 * @returns {Promise<{ params: object, rationale: string, confidence: number }>}
 */
export async function aiSuggest({ bitmap, prompt } = {}) {
  if (!bitmap) throw new Error('Load a photo first.')

  const image = bitmapToDataUrl(bitmap, MAX_DIM)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, prompt: prompt || undefined }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('The AI request timed out. Try again.')
    }
    throw new Error(
      'Could not reach the AI server. Is `npm run server` running?',
    )
  }
  clearTimeout(timer)

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('The AI server returned an invalid response.')
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `AI server error (${res.status}).`)
  }

  return normalizeAiResponse(data)
}

/**
 * Validate + clamp the server/model response into our params shape.
 * Pure function so it can be unit-tested without canvas or network.
 */
export function normalizeAiResponse(data) {
  const raw = data?.params ?? {}
  const params = {}
  for (const key of PARAM_KEYS) {
    const n = Number(raw[key])
    params[key] = Number.isFinite(n) ? n : 0
  }
  return {
    params: clampParams(params),
    rationale: typeof data?.rationale === 'string' ? data.rationale : '',
    confidence: clampNumber(data?.confidence, 0, 1),
  }
}

function bitmapToDataUrl(bitmap, max) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.8)
}

function clampNumber(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(max, Math.max(min, n))
}
