// Reads a bitmap and produces measurable properties of the photo.
// Everything here is native canvas pixel access + plain JavaScript math.

const ANALYSIS_MAX = 384 // small enough to be instant, statistically representative

export function analyzeBitmap(bitmap) {
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const n = w * h
  const hist = new Uint32Array(256)
  const lum = new Float32Array(n)

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumSat = 0
  let sumY = 0

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lum[p] = y
    hist[y | 0]++
    sumY += y
    sumR += r
    sumG += g
    sumB += b
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b
    sumSat += mx === 0 ? 0 : (mx - mn) / mx
  }

  // luminance variance (contrast)
  const meanY = sumY / n
  let varY = 0
  for (let p = 0; p < n; p++) {
    const d = lum[p] - meanY
    varY += d * d
  }
  varY /= n

  const pct = (q) => {
    const target = q * n
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= target) return v
    }
    return 255
  }

  const p1 = pct(0.01)
  const p5 = pct(0.05)
  const p50 = pct(0.5)
  const p95 = pct(0.95)
  const p99 = pct(0.99)

  // clipping
  let blacks = 0
  for (let v = 0; v <= 2; v++) blacks += hist[v]
  let whites = 0
  for (let v = 253; v <= 255; v++) whites += hist[v]

  // sharpness: variance of the Laplacian over luminance
  let lapSum = 0
  let lapSumSq = 0
  let lapCount = 0
  let flatSum = 0
  let flatCount = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap =
        -4 * lum[i] + lum[i - 1] + lum[i + 1] + lum[i - w] + lum[i + w]
      lapSum += lap
      lapSumSq += lap * lap
      lapCount++
      if (Math.abs(lap) < 8) {
        flatSum += Math.abs(lap)
        flatCount++
      }
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0
  const lapVar = lapCount ? lapSumSq / lapCount - lapMean * lapMean : 0
  const noiseEstimate = flatCount ? flatSum / flatCount / 255 : 0

  const meanR = sumR / n / 255
  const meanG = sumG / n / 255
  const meanB = sumB / n / 255

  const result = {
    width: bitmap.width,
    height: bitmap.height,
    brightness: { mean: meanY / 255, median: p50 / 255 },
    percentiles: {
      p1: p1 / 255,
      p5: p5 / 255,
      p50: p50 / 255,
      p95: p95 / 255,
      p99: p99 / 255,
    },
    contrast: { range: (p95 - p5) / 255, stdDev: Math.sqrt(varY) / 255 },
    clipping: { blacks: blacks / n, whites: whites / n },
    color: {
      meanR,
      meanG,
      meanB,
      cast: classifyCast(meanR, meanG, meanB),
      castStrength: Math.abs(meanR - meanB),
    },
    saturation: { mean: sumSat / n },
    sharpness: {
      laplacianVariance: lapVar,
      quality: lapVar < BLUR_THRESHOLD ? 'soft' : 'sharp',
    },
    noise: { estimate: noiseEstimate, quality: noiseQuality(noiseEstimate) },
  }

  result.assessment = assess(result)
  return result
}

const BLUR_THRESHOLD = 60

function noiseQuality(est) {
  if (est < 0.012) return 'clean'
  if (est < 0.03) return 'moderate'
  return 'noisy'
}

function classifyCast(r, g, b) {
  const d = r - b
  if (Math.abs(d) <= 0.05) return 'neutral'
  return d > 0 ? 'warm' : 'cool'
}

// Rule-based classifier: compare measured values to healthy targets.
export function assess(m) {
  const out = []

  if (m.brightness.median < 0.35)
    out.push({
      property: 'brightness',
      status: 'too dark',
      value: m.brightness.median,
      target: 0.5,
      reason: `median luminance ${m.brightness.median.toFixed(2)} is below 0.35`,
    })
  else if (m.brightness.median > 0.7)
    out.push({
      property: 'brightness',
      status: 'too bright',
      value: m.brightness.median,
      target: 0.5,
      reason: `median luminance ${m.brightness.median.toFixed(2)} is above 0.70`,
    })

  if (m.contrast.range < 0.5)
    out.push({
      property: 'contrast',
      status: 'flat',
      value: m.contrast.range,
      target: 0.7,
      reason: `tone range ${m.contrast.range.toFixed(2)} is narrow (hazy / flat)`,
    })

  if (m.color.cast !== 'neutral')
    out.push({
      property: 'color',
      status: m.color.cast === 'cool' ? 'cool cast' : 'warm cast',
      value: m.color.castStrength,
      target: 0,
      reason: `${m.color.cast === 'cool' ? 'blue' : 'red'} channel dominates by ${m.color.castStrength.toFixed(2)}`,
    })

  if (m.saturation.mean < 0.18)
    out.push({
      property: 'saturation',
      status: 'washed out',
      value: m.saturation.mean,
      target: 0.35,
      reason: `average saturation ${m.saturation.mean.toFixed(2)} is low`,
    })
  else if (m.saturation.mean > 0.62)
    out.push({
      property: 'saturation',
      status: 'oversaturated',
      value: m.saturation.mean,
      target: 0.4,
      reason: `average saturation ${m.saturation.mean.toFixed(2)} is high`,
    })

  if (m.clipping.blacks > 0.1)
    out.push({
      property: 'shadows',
      status: 'crushed blacks',
      value: m.clipping.blacks,
      target: 0.02,
      reason: `${(m.clipping.blacks * 100).toFixed(1)}% of pixels are pure black`,
    })
  if (m.clipping.whites > 0.1)
    out.push({
      property: 'highlights',
      status: 'blown highlights',
      value: m.clipping.whites,
      target: 0.02,
      reason: `${(m.clipping.whites * 100).toFixed(1)}% of pixels are pure white`,
    })

  if (m.sharpness.quality === 'soft')
    out.push({
      property: 'sharpness',
      status: 'soft',
      value: m.sharpness.laplacianVariance,
      target: BLUR_THRESHOLD,
      reason: `edge detail low (Laplacian variance ${Math.round(m.sharpness.laplacianVariance)})`,
    })

  return out
}
