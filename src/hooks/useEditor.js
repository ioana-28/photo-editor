import { useMemo, useReducer } from 'react'
import {
  NEUTRAL_PARAMS,
  addParams,
  clampParams,
  combineParams,
  neutralParams,
} from '../lib/filters'
import {
  findPreset,
  getAllPresets,
  loadUserPresets,
  makeUserPreset,
  saveUserPresets,
} from '../lib/presets'

function init() {
  return {
    status: 'empty',
    error: null,
    image: null,
    analysis: null,
    selectedPresetId: null,
    intensity: 1,
    manual: neutralParams(),
    userPresets: loadUserPresets(),
    compare: false,
    aiRationale: '',
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', error: null }
    case 'LOAD_SUCCESS':
      return {
        ...init(),
        userPresets: state.userPresets,
        status: 'ready',
        image: action.image,
        analysis: action.analysis,
      }
    case 'LOAD_ERROR':
      return { ...state, status: 'empty', error: action.message }
    case 'SELECT_PRESET': {
      const preset = findPreset(getAllPresets(state.userPresets), action.id)
      return {
        ...state,
        selectedPresetId: action.id,
        intensity: preset?.defaultIntensity ?? 1,
      }
    }
    case 'SET_INTENSITY':
      return { ...state, intensity: action.value }
    case 'SET_MANUAL_PARAM':
      return {
        ...state,
        manual: clampParams({ ...state.manual, [action.key]: action.value }),
      }
    case 'APPLY_DELTA':
      return { ...state, manual: clampParams(addParams(state.manual, action.params)) }
    case 'SET_MANUAL':
      return { ...state, manual: clampParams({ ...neutralParams(), ...action.params }) }
    case 'RESET_MANUAL':
      return { ...state, manual: neutralParams() }
    case 'SET_COMPARE':
      return { ...state, compare: action.value }
    case 'ADD_USER_PRESET': {
      const list = [...state.userPresets, action.preset]
      saveUserPresets(list)
      return { ...state, userPresets: list }
    }
    case 'DELETE_USER_PRESET': {
      const list = state.userPresets.filter((p) => p.id !== action.id)
      saveUserPresets(list)
      return {
        ...state,
        userPresets: list,
        selectedPresetId:
          state.selectedPresetId === action.id ? null : state.selectedPresetId,
      }
    }
    case 'IMPORT_PRESETS': {
      const list = [...state.userPresets, ...action.list]
      saveUserPresets(list)
      return { ...state, userPresets: list }
    }
    case 'SET_RATIONALE':
      return { ...state, aiRationale: action.value }
    case 'RESET_ALL':
      return {
        ...state,
        selectedPresetId: null,
        intensity: 1,
        manual: neutralParams(),
        compare: false,
      }
    default:
      return state
  }
}

export function useEditor() {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  const allPresets = useMemo(
    () => getAllPresets(state.userPresets),
    [state.userPresets],
  )

  const selectedPreset = useMemo(
    () => findPreset(allPresets, state.selectedPresetId),
    [allPresets, state.selectedPresetId],
  )

  const effectiveParams = useMemo(() => {
    if (state.compare) return { ...NEUTRAL_PARAMS }
    return combineParams(
      selectedPreset?.params ?? NEUTRAL_PARAMS,
      state.manual,
      state.intensity,
    )
  }, [selectedPreset, state.manual, state.intensity, state.compare])

  const actions = useMemo(
    () => ({
      loadStart: () => dispatch({ type: 'LOAD_START' }),
      loadSuccess: (image, analysis) =>
        dispatch({ type: 'LOAD_SUCCESS', image, analysis }),
      loadError: (message) => dispatch({ type: 'LOAD_ERROR', message }),
      selectPreset: (id) => dispatch({ type: 'SELECT_PRESET', id }),
      setIntensity: (value) => dispatch({ type: 'SET_INTENSITY', value }),
      setManualParam: (key, value) =>
        dispatch({ type: 'SET_MANUAL_PARAM', key, value }),
      applyDelta: (params) => dispatch({ type: 'APPLY_DELTA', params }),
      setManual: (params) => dispatch({ type: 'SET_MANUAL', params }),
      resetManual: () => dispatch({ type: 'RESET_MANUAL' }),
      setCompare: (value) => dispatch({ type: 'SET_COMPARE', value }),
      savePreset: (name, params) =>
        dispatch({ type: 'ADD_USER_PRESET', preset: makeUserPreset(name, params) }),
      deletePreset: (id) => dispatch({ type: 'DELETE_USER_PRESET', id }),
      importPresets: (list) => dispatch({ type: 'IMPORT_PRESETS', list }),
      setRationale: (value) => dispatch({ type: 'SET_RATIONALE', value }),
      resetAll: () => dispatch({ type: 'RESET_ALL' }),
    }),
    [],
  )

  const hasManual = useMemo(
    () => Object.values(state.manual).some((v) => Math.abs(v) > 1e-4),
    [state.manual],
  )

  return { state, allPresets, selectedPreset, effectiveParams, hasManual, actions }
}
