import http from 'node:http'
import { analyzeImage, analyzeReference } from './deepseek.js'

const PORT = Number(process.env.PORT) || 3001
const MAX_BODY_BYTES = 40 * 1024 * 1024

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const server = http.createServer(async (req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
      model: 'deepseek-flash',
      port: PORT,
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    try {
      const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
      let input

      if (contentType.includes('application/json')) {
        const raw = await readBody(req)
        let parsed
        try {
          parsed = JSON.parse(raw.toString('utf8') || '{}')
        } catch {
          throw new HttpError(400, 'Invalid JSON body.')
        }
        input = {
          imagePath: parsed.imagePath,
          image: parsed.image,
          prompt: parsed.prompt,
        }
      } else if (contentType.startsWith('image/')) {
        const body = await readBody(req)
        const mime = contentType.split(';')[0].trim()
        input = {
          image: `data:${mime};base64,${body.toString('base64')}`,
          prompt: url.searchParams.get('prompt') ?? undefined,
        }
      } else {
        throw new HttpError(
          415,
          'Send application/json, or a raw image body with an image/* Content-Type.',
        )
      }

      const result = await analyzeImage(input)
      sendJson(res, 200, { ok: true, model: 'deepseek-flash', ...result })
    } catch (err) {
      const status = err.status ?? 500
      sendJson(res, status, {
        ok: false,
        error: err.message || 'Unknown error',
      })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze-reference') {
    try {
      const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
      if (!contentType.includes('application/json')) {
        throw new HttpError(
          415,
          'Send application/json for /api/analyze-reference.',
        )
      }
      const raw = await readBody(req)
      let parsed
      try {
        parsed = JSON.parse(raw.toString('utf8') || '{}')
      } catch {
        throw new HttpError(400, 'Invalid JSON body.')
      }

      const result = await analyzeReference({
        before: parsed.before,
        after: parsed.after,
        target: parsed.target,
        beforePath: parsed.beforePath,
        afterPath: parsed.afterPath,
        targetPath: parsed.targetPath,
        prompt: parsed.prompt,
      })
      sendJson(res, 200, { ok: true, model: 'deepseek-flash', ...result })
    } catch (err) {
      const status = err.status ?? 500
      sendJson(res, status, {
        ok: false,
        error: err.message || 'Unknown error',
      })
    }
    return
  }

  sendJson(res, 404, {
    ok: false,
    error: `Not found: ${req.method} ${url.pathname}`,
  })
})

server.listen(PORT, () => {
  const hasKey = Boolean(process.env.DEEPSEEK_API_KEY)
  console.log(`\nDeepSeek analysis server running at http://localhost:${PORT}`)
  console.log(`  Health:  GET  http://localhost:${PORT}/health`)
  console.log(`  Analyze: POST http://localhost:${PORT}/api/analyze`)
  console.log(
    `  API key: ${hasKey ? 'loaded' : 'MISSING — put DEEPSEEK_API_KEY in .env'}\n`,
  )
})

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload, null, 2))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large (max 40 MB).'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
