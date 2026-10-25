import { autoEnhanceParams } from './autoEnhance'
import { neutralParams } from './filters'

/**
 * Provider-agnostic seam. Today it only knows the local heuristic engine.
 * Later, an AI branch can be added here WITHOUT touching the UI or pipeline:
 *
 *   if (mode === 'ai') return aiSuggest({ previewBitmap, prompt })
 *
 * `aiSuggest` can be a cloud vision LLM (via a serverless proxy that holds the
 * key) or an on-device model — both must return the same shape below.
 *
 * @returns {Promise<{ params: object, source: string, rationale: string }>}
 */
export async function suggestParams({ analysis, mode = 'heuristic' } = {}) {
  if (mode === 'heuristic') {
    const params = analysis ? autoEnhanceParams(analysis) : neutralParams()
    const count = analysis?.assessment?.length ?? 0
    return {
      params,
      source: 'heuristic',
      rationale: count
        ? `Applied ${count} measured correction${count === 1 ? '' : 's'}.`
        : 'Photo already looks well balanced.',
    }
  }

  // Reserved for AI providers.
  return { params: neutralParams(), source: 'none', rationale: '' }
}
