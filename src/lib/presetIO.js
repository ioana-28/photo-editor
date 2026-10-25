import { neutralParams } from './filters'

export function downloadPresetsFile(presets, filename = 'presets.json') {
  const payload = { version: 1, presets }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  triggerDownload(blob, filename)
}

export async function readPresetsFile(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : data.presets
  if (!Array.isArray(list)) throw new Error('No presets found in this file.')
  return list.map((p) => ({
    id: p.id ?? `imported-${Math.random().toString(36).slice(2, 8)}`,
    name: p.name ?? 'Imported Preset',
    tags: p.tags ?? ['imported'],
    source: 'user',
    defaultIntensity: p.defaultIntensity ?? 1,
    params: { ...neutralParams(), ...(p.params ?? {}) },
  }))
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
