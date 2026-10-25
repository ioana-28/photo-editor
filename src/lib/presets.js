import builtIn from '../data/presets.json'
import { neutralParams } from './filters'

const LS_KEY = 'photo-editor.userPresets.v1'

export function loadBuiltInPresets() {
  return builtIn.presets.map((p) => ({ ...p, params: normalize(p.params) }))
}

export function loadUserPresets() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.map((p) => ({
      source: 'user',
      defaultIntensity: 1,
      tags: [],
      ...p,
      params: normalize(p.params),
    }))
  } catch {
    return []
  }
}

export function saveUserPresets(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

export function getAllPresets(userPresets) {
  return [...loadBuiltInPresets(), ...userPresets]
}

export function findPreset(list, id) {
  return list.find((p) => p.id === id) ?? null
}

export function makeUserPreset(name, params) {
  const id = `user-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
  return {
    id,
    name: name?.trim() || 'My Preset',
    tags: ['custom'],
    source: 'user',
    defaultIntensity: 1,
    params: { ...neutralParams(), ...params },
  }
}

function normalize(params) {
  return { ...neutralParams(), ...(params ?? {}) }
}
