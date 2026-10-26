import { useMemo, useReducer } from 'react'
import {
  NEUTRAL_PARAMS,
  addParams,
  clampParams,
  neutralParams,
  scaleParams,
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
    auto: neutralParams(),
    autoIntensity: 1,
    userPresets: loadUserPresets(),
    compare: false,
    comparePinned: false,
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
    case 'TOGGLE_COMPARE_PINNED':
      return { ...state, comparePinned: !state.comparePinned }
    case 'SET_AUTO':
      return { ...state, auto: clampParams(action.params) }
    case 'ADD_AUTO':
      return {
        ...state,
        auto: clampParams(addParams(state.auto, action.params)),
      }
    case 'SET_AUTO_INTENSITY':
      return { ...state, autoIntensity: action.value }
    case 'RESET_AUTO':
      return { ...state, auto: neutralParams(), autoIntensity: 1 }
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
        auto: neutralParams(),
        autoIntensity: 1,
        compare: false,
        comparePinned: false,
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
    if (state.compare || state.comparePinned) return { ...NEUTRAL_PARAMS }
    const fromPreset = scaleParams(
      selectedPreset?.params ?? NEUTRAL_PARAMS,
      state.intensity,
    )
    const fromAuto = scaleParams(state.auto, state.autoIntensity)
    return clampParams(addParams(addParams(fromPreset, state.manual), fromAuto))
  }, [
    selectedPreset,
    state.manual,
    state.auto,
    state.intensity,
    state.autoIntensity,
    state.compare,
    state.comparePinned,
  ])

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
      toggleComparePinned: () => dispatch({ type: 'TOGGLE_COMPARE_PINNED' }),
      setAuto: (params) => dispatch({ type: 'SET_AUTO', params }),
      addAuto: (params) => dispatch({ type: 'ADD_AUTO', params }),
      setAutoIntensity: (value) =>
        dispatch({ type: 'SET_AUTO_INTENSITY', value }),
      resetAuto: () => dispatch({ type: 'RESET_AUTO' }),
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

  const hasAuto = useMemo(
    () => Object.values(state.auto).some((v) => Math.abs(v) > 1e-4),
    [state.auto],
  )

  return {
    state,
    allPresets,
    selectedPreset,
    effectiveParams,
    hasManual,
    hasAuto,
    actions,
  }
}
