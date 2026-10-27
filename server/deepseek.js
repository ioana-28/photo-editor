import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { clampParams, PARAM_KEYS } from '../src/lib/filters.js'

const API_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-flash'
const TIMEOUT_MS = 60000

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const PARAMS_SCHEMA = `{
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
}`

const RANGES = `Ranges:
- brightness, contrast, shadows, highlights, saturation, vibrance, warmth: -1 to 1
- hue: -180 to 180 (degrees)
- fade, vignette, grain, sharpen: 0 to 1
- confidence: 0 to 1
`

const GUIDELINES = `Guidelines:
- Be conservative. Small, natural corrections are better than extreme ones.
- Fix objective problems first: exposure, white balance, contrast, clipping.
- Only add stylistic effects (vignette, grain, fade) when the intent asks for a look.
- "warmth" positive = warmer/yellower, negative = cooler/bluer.
- "shadows" positive lifts dark areas; "highlights" positive brightens bright areas,
  negative recovers blown highlights.
- Leave a parameter at 0 when no change is needed.
- Make changes such that the people are being seen in a flattering way, and skin tones look natural.
- The background should not be overexposed or underexposed, and the subject should be clearly visible.
- If the image is darker, don't lift the shadows too much, as it can make the image look unnatural. Instead, try to adjust the overall brightness and contrast to achieve a balanced exposure.
- If the image is brighter, avoid overexposing the highlights. Instead, try to adjust the overall brightness and contrast to achieve a balanced exposure.
- If the image has a color cast, try to correct it by adjusting the warmth and hue parameters. Avoid making the image look too warm or too cool.`

const SINGLE_SYSTEM_PROMPT = `You are a professional photo-editing assistant.
Analyze the image and suggest editing parameters that would improve it.

Respond ONLY with a JSON object using exactly this shape:
${PARAMS_SCHEMA}

${RANGES}
${GUIDELINES}

Respond with json.`

const REFERENCE_SYSTEM_PROMPT = `You are a professional photo-editing assistant.
You are given three images, in this order:
1) IMAGE 1 - BEFORE: a reference photo before editing.
2) IMAGE 2 - AFTER: the same reference photo after editing.
3) IMAGE 3 - TARGET: a different photo to apply the same edit/style to.

Infer the edit made from BEFORE to AFTER, then express it as parameters to
apply to TARGET.

Respond ONLY with a JSON object using exactly this shape:
{
  "editSummary": "one short sentence describing the edit made from BEFORE to AFTER",
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
  "rationale": "one or two short sentences explaining the changes for TARGET",
  "confidence": number
}

${RANGES}
- confidence: 0 to 1

Guidelines:
- Infer only global color/tone/style edits: exposure, white balance, contrast,
  saturation, fade, vignette, grain and sharpness.
- Ignore local edits such as retouching, object removal, masking or cropping.
- Be conservative.
- Leave a parameter at 0 when no change is needed.
- I want to 

Respond with json.`

/**
 * Analyze a single image using the DeepSeek vision API.
 *
 * @param {object} input
 * @param {string} [input.imagePath]  local file path (simplest, for testing)
 * @param {string} [input.image]      full data URL (data:image/...;base64,...)
 * @param {string} [input.prompt]     optional free-text intent
 */
export async function analyzeImage({ imagePath, image, prompt } = {}) {
  const dataUrl = imagePath ? await fileToDataUrl(imagePath) : normalizeDataUrl(image)
  if (!dataUrl) {
    throw new Error('Provide "imagePath" (local file) or "image" (data URL).')
  }

  const intent = (prompt ?? '').toString().trim()
  const userText = intent
    ? `Analyze this photo and suggest edits. User intent: ${intent}`
    : 'Analyze this photo and suggest the best conservative edits.'

  const { parsed, usage } = await callDeepSeek({
    system: SINGLE_SYSTEM_PROMPT,
    content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
    ],
  })

  return {
    params: coerceParams(parsed.params),
    rationale: asString(parsed.rationale),
    confidence: clampNumber(parsed.confidence, 0, 1, 0),
    usage,
  }
}

/**
 * Infer the edit between a BEFORE/AFTER reference pair and apply it to TARGET.
 * Accepts data URLs or local paths (paths are handy for Postman testing).
 */
export async function analyzeReference({
  before,
  after,
  target,
  beforePath,
  afterPath,
  targetPath,
  prompt,
} = {}) {
  const beforeUrl = beforePath ? await fileToDataUrl(beforePath) : normalizeDataUrl(before)
  const afterUrl = afterPath ? await fileToDataUrl(afterPath) : normalizeDataUrl(after)
  const targetUrl = targetPath ? await fileToDataUrl(targetPath) : normalizeDataUrl(target)

  if (!beforeUrl || !afterUrl || !targetUrl) {
    throw new Error(
      'Provide the reference original, reference edited, and target photo ' +
        '(as data URLs "before"/"after"/"target" or paths "beforePath"/"afterPath"/"targetPath").',
    )
  }

  const intent = (prompt ?? '').toString().trim()
  const intro =
    'IMAGE 1 is BEFORE. IMAGE 2 is AFTER. IMAGE 3 is TARGET. ' +
    'Infer the edit from BEFORE to AFTER and apply it to TARGET.' +
    (intent ? ` Additional user intent: ${intent}` : '')

  const { parsed, usage } = await callDeepSeek({
    system: REFERENCE_SYSTEM_PROMPT,
    content: [
      { type: 'text', text: intro },
      { type: 'image_url', image_url: { url: beforeUrl, detail: 'low' } },
      { type: 'image_url', image_url: { url: afterUrl, detail: 'low' } },
      { type: 'image_url', image_url: { url: targetUrl, detail: 'low' } },
    ],
  })

  return {
    params: coerceParams(parsed.params),
    editSummary: asString(parsed.editSummary),
    rationale: asString(parsed.rationale),
    confidence: clampNumber(parsed.confidence, 0, 1, 0),
    usage,
  }
}

async function callDeepSeek({ system, content }) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Add it to .env.local and restart the server.',
    )
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 600,
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

  const contentText = data?.choices?.[0]?.message?.content
  if (!contentText) throw new Error('DeepSeek returned no content.')

  return { parsed: parseModelJson(contentText), usage: data.usage ?? null }
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

function asString(value) {
  return typeof value === 'string' ? value : ''
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
