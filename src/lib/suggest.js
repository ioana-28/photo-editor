import { autoEnhanceParams } from './autoEnhance'
import { neutralParams } from './filters'
import { aiSuggest } from './aiSuggest'

/**
 * Provider-agnostic seam.
 *
 * - mode "heuristic": local, offline photo measurement (default).
 * - mode "ai":        asks the local DeepSeek server for suggested params.
 *
 * Both return the same shape, so the UI and pipeline never care who answered:
 *   { params, rationale, source, confidence? }
 *
 * @returns {Promise<{ params: object, rationale: string, source: string }>}
 */
export async function suggestParams({
  analysis,
  mode = 'heuristic',
  bitmap,
  prompt,
} = {}) {
  if (mode === 'ai') {
    const result = await aiSuggest({ bitmap, prompt })
    return { ...result, source: 'ai' }
  }

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

  return { params: neutralParams(), source: 'none', rationale: '' }
}
