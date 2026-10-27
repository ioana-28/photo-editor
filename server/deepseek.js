import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { clampParams, PARAM_KEYS } from '../src/lib/filters.js'

const API_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-flash'
const TIMEOUT_MS = 30000

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const SYSTEM_PROMPT = `You are a professional photo-editing assistant.
Analyze the image and suggest editing parameters that would improve it.

Respond ONLY with a JSON object using exactly this shape:
{
  "params": {
    "brightness": number,
    "contrast": number,
    "shadows": number,
    "highlights": number,
    "saturation": number,
    "vibrance": number,
    "warmth": number,
    "hue": number,
    "fade": number,
    "vignette": number,
    "grain": number,
    "sharpen": number
  },
  "rationale": "one or two short sentences explaining the main changes",
  "confidence": number
}

Ranges:
- brightness, contrast, shadows, highlights, saturation, vibrance, warmth: -1 to 1
- hue: -180 to 180 (degrees)
- fade, vignette, grain, sharpen: 0 to 1
- confidence: 0 to 1

Guidelines:
- Be conservative. Small, natural corrections are better than extreme ones.
- Fix objective problems first: exposure, white balance, contrast, clipping.
- Only add stylistic effects (vignette, grain, fade) when the intent asks for a look.
- "warmth" positive = warmer/yellower, negative = cooler/bluer.
- "shadows" positive lifts dark areas; "highlights" positive brightens bright areas,
  negative recovers blown highlights.
- Leave a parameter at 0 when no change is needed.

Respond with json.`

/**
 * Analyze an image using the DeepSeek vision API.
 *
 * @param {object} input
 * @param {string} [input.imagePath]  local file path (simplest, for testing)
 * @param {string} [input.image]      full data URL (data:image/...;base64,...)
 * @param {string} [input.prompt]     optional free-text intent
 * @returns {Promise<{params: object, rationale: string, confidence: number, usage: object}>}
 */
export async function analyzeImage({ imagePath, image, prompt } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Add it to .env and restart the server.',
    )
  }

  const dataUrl = imagePath ? await fileToDataUrl(imagePath) : normalizeDataUrl(image)
  if (!dataUrl) {
    throw new Error('Provide "imagePath" (local file) or "image" (data URL).')
  }

  const intent = (prompt ?? '').toString().trim()
  const userText = intent
    ? `Analyze this photo and suggest edits. User intent: ${intent}`
    : 'Analyze this photo and suggest the best conservative edits.'

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'low' },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 500,
    stream: false,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error(`DeepSeek request timed out after ${TIMEOUT_MS / 1000}s.`)
    }
    throw new Error(`Could not reach DeepSeek: ${err.message}`)
  }
  clearTimeout(timer)

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`DeepSeek API error (${res.status}): ${sanitize(text)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('DeepSeek returned a non-JSON HTTP response.')
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek returned no content.')

  const parsed = parseModelJson(content)
  const params = coerceParams(parsed.params)

  return {
    params,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    confidence: clampNumber(parsed.confidence, 0, 1, 0),
    usage: data.usage ?? null,
  }
}

export function parseModelJson(content) {
  let text = String(content).trim()
  // Strip ```json ... ``` fences if the model added them.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1].trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error('Could not parse JSON from the model response.')
  }
}

export function coerceParams(raw) {
  const out = {}
  for (const key of PARAM_KEYS) {
    out[key] = Number(raw?.[key])
    if (!Number.isFinite(out[key])) out[key] = 0
  }
  return clampParams(out)
}

export async function fileToDataUrl(filePath) {
  let buffer
  try {
    buffer = await readFile(filePath)
  } catch {
    throw new Error(`Could not read image file: ${filePath}`)
  }
  const ext = extname(filePath).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    throw new Error(
      `Unsupported file type "${ext || 'unknown'}". Use JPEG, PNG, WebP or GIF.`,
    )
  }
  return `data:${mime};base64,${buffer.toString('base64')}`
}

function normalizeDataUrl(image) {
  if (!image || typeof image !== 'string') return null
  if (image.startsWith('data:')) return image
  // Accept a bare base64 string and assume JPEG.
  return `data:image/jpeg;base64,${image}`
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function sanitize(text) {
  // Keep provider error messages short and never echo secrets.
  return String(text).slice(0, 500)
}
