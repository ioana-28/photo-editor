import { useCallback, useEffect, useRef, useState } from 'react'
import Toolbar from './components/Toolbar'
import ImageUploader from './components/ImageUploader'
import EditorCanvas from './components/EditorCanvas'
import PresetGrid from './components/PresetGrid'
import AdjustmentPanel from './components/AdjustmentPanel'
import IntensityControl from './components/IntensityControl'
import SuggestionChips from './components/SuggestionChips'
import PresetIOMenu from './components/PresetIOMenu'
import MatchReference from './components/MatchReference'
import { useEditor } from './hooks/useEditor'
import { loadImageFile, makeThumbnail } from './lib/imageLoader'
import { analyzeBitmap } from './lib/analyze'
import { autoEnhanceParams } from './lib/autoEnhance'
import { suggestParams } from './lib/suggest'
import { exportImage } from './lib/exportImage'

export default function App() {
  const { state, allPresets, effectiveParams, actions } = useEditor()
  const [format, setFormat] = useState('image/jpeg')
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [thumbSource, setThumbSource] = useState(null)
  const dragDepth = useRef(0)

  const handleFile = useCallback(
    async (file) => {
      actions.loadStart()
      try {
        const loaded = await loadImageFile(file)
        const analysis = analyzeBitmap(loaded.preview)
        setThumbSource(makeThumbnail(loaded.preview, 170))
        actions.loadSuccess(loaded, analysis)
      } catch (e) {
        actions.loadError(e.message || 'Could not load that image.')
      }
    },
    [actions],
  )

  // Whole-window drag & drop.
  useEffect(() => {
    const onEnter = (e) => {
      e.preventDefault()
      dragDepth.current += 1
      setDragActive(true)
    }
    const onOver = (e) => e.preventDefault()
    const onLeave = (e) => {
      e.preventDefault()
      dragDepth.current -= 1
      if (dragDepth.current <= 0) {
        dragDepth.current = 0
        setDragActive(false)
      }
    }
    const onDrop = (e) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragActive(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) handleFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  const handleAuto = useCallback(async () => {
    if (!state.analysis) return
    const { params } = await suggestParams({
      analysis: state.analysis,
      mode: 'heuristic',
    })
    actions.applyDelta(params)
  }, [state.analysis, actions])

  const handleDownload = useCallback(async () => {
    if (!state.image) return
    setBusy(true)
    try {
      await exportImage({
        fullBitmap: state.image.full,
        params: effectiveParams,
        format,
        filename: state.image.name,
      })
    } catch (e) {
      window.alert(e.message || 'Export failed.')
    } finally {
      setBusy(false)
    }
  }, [state.image, effectiveParams, format])

  // Keyboard: R resets everything.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'r' || e.key === 'R') actions.resetAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])

  const ready = state.status === 'ready' && state.image

  return (
    <div className="app">
      <Toolbar
        hasImage={!!ready}
        busy={busy}
        canAuto={!!state.analysis}
        onFile={handleFile}
        onAuto={handleAuto}
        onResetAll={actions.resetAll}
        onDownload={handleDownload}
        format={format}
        setFormat={setFormat}
      />

      {ready ? (
        <div className="main">
          <aside className="panel left">
            <PresetGrid
              presets={allPresets}
              thumbSource={thumbSource}
              selectedId={state.selectedPresetId}
              onSelect={actions.selectPreset}
              onDelete={actions.deletePreset}
            />
            <PresetIOMenu
              userPresets={state.userPresets}
              allPresets={allPresets}
              canSave={!!state.image}
              onSave={(name) => actions.savePreset(name, effectiveParams)}
              onImport={actions.importPresets}
              disabled={busy}
            />
            <MatchReference
              targetBitmap={state.image.preview}
              onApply={actions.applyDelta}
              disabled={busy}
            />
          </aside>

          <EditorCanvas
            bitmap={state.image.preview}
            params={effectiveParams}
            comparing={state.compare}
            onCompareStart={() => actions.setCompare(true)}
            onCompareEnd={() => actions.setCompare(false)}
          />

          <aside className="panel right">
            <SuggestionChips
              analysis={state.analysis}
              onApply={actions.applyDelta}
              onApplyAll={() => actions.applyDelta(autoEnhanceParams(state.analysis))}
              disabled={busy}
            />
            <IntensityControl
              value={state.intensity}
              onChange={actions.setIntensity}
              disabled={busy}
            />
            <AdjustmentPanel
              manual={state.manual}
              onChange={actions.setManualParam}
              onReset={actions.resetManual}
              disabled={busy}
            />
          </aside>
        </div>
      ) : (
        <div className="main single">
          <ImageUploader
            onFile={handleFile}
            dragActive={dragActive}
            error={state.error}
          />
        </div>
      )}
    </div>
  )
}
