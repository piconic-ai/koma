'use client'

import { createEffect, createMemo, createSignal, onCleanup, onMount } from '@barefootjs/client'
import { Player } from '@/components/Player'
import { FrameEditor } from '@/components/FrameEditor'
import { AppHeader } from '@/components/AppHeader'
import { ThemeBar } from '@/components/ThemeBar'
import { TimelineBar } from '@/components/TimelineBar'
import {
  addFrame,
  frameLanguage,
  removeFrame,
  setTheme,
  updateFrame,
} from '../src/model/spec'
import type { CanvasWidth, Language, Spec, ThemeId } from '../src/model/types'
import { randomThemeId, resolveTheme, sampleSpec } from '../src/render/themes'

import { decodeFromHash, encodeToHash } from '../src/state/url'

interface AppProps {
  initialSpec: Spec
}

// @bf-ignore props-destructuring
export function App({ initialSpec }: AppProps) {
  const [spec, setSpec] = createSignal<Spec>(initialSpec)
  const [selectedFrameId, setSelectedFrameId] = createSignal<string | null>(null)

  // Whether the user has touched the koma content. While pristine, switching
  // theme also swaps in that theme's brand-fitting default sample; once the
  // user edits (or a shared spec is loaded from the URL), their code is kept.
  const [edited, setEdited] = createSignal(false)
  const markEdited = () => setEdited(true)

  // Apply a theme. On a pristine spec, also load the theme's default koma;
  // once edited, only the theme changes and the user's code stays.
  const applyTheme = (id: ThemeId) => {
    if (edited()) {
      setSpec(s => setTheme(s, id))
    } else {
      setSpec(sampleSpec(id))
    }
  }

  let appEl: HTMLElement | null = null
  let dockEl: HTMLElement | null = null
  let footerEl: HTMLElement | null = null

  const editorWidth = createMemo(() => spec().width ?? 1080)
  const contentMaxWidth = () => Math.round(editorWidth() * 0.64)
  const editorStyle = () => `max-width:${contentMaxWidth()}px`

  // The editor highlights with the active preset's code style, so the editing
  // surface matches the previewed code window.
  const theme = createMemo(() => resolveTheme(spec().theme))

  // Display-only sizing of the preview. By default the canvas fits the editor
  // column width (see .koma-canvas). Once the user drags the resize handle we
  // switch to an explicit height, letting them shrink or enlarge it while the
  // intrinsic aspect ratio is preserved. Export resolution is unaffected.
  const [previewHeight, setPreviewHeight] = createSignal(360)
  const [previewResized, setPreviewResized] = createSignal(false)

  // The preview canvas is collapsed by default so the editing surface stays
  // calm; it expands when the user plays (or toggles it open by hand). The
  // theme bar stays visible either way.
  const [previewExpanded, setPreviewExpanded] = createSignal(false)

  const handleEdgeDrag = (e: PointerEvent, side: 'left' | 'right') => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = editorWidth()
    const el = (e.currentTarget as HTMLElement)
    el.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const dx = side === 'right' ? ev.clientX - startX : startX - ev.clientX
      const raw = startWidth + dx * 2
      const clamped = Math.max(640, Math.min(1920, Math.round(raw / 10) * 10))
      setSpec(s => ({ ...s, width: clamped as CanvasWidth }))
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const handlePreviewResize = (e: PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const el = (e.currentTarget as HTMLElement)
    el.setPointerCapture(e.pointerId)

    // Base the drag on what's actually on screen. The upper bound is the
    // height at which the canvas would span the full dock width — so the
    // preview can be enlarged well past the editor column, but never wider
    // than the dock (which would overflow the viewport).
    const canvas = document.getElementById('koma-preview-canvas') as HTMLCanvasElement | null
    const startHeight = canvas ? canvas.getBoundingClientRect().height : previewHeight()
    const dockWidth = dockEl ? dockEl.clientWidth - 48 : 0
    const fullWidthHeight = canvas && canvas.width && dockWidth
      ? dockWidth * (canvas.height / canvas.width)
      : 720
    const maxHeight = Math.max(120, Math.round(fullWidthHeight))

    // Seed the explicit height from the current on-screen size so switching out
    // of the default fit-to-column mode doesn't jump.
    setPreviewHeight(Math.round(startHeight))
    setPreviewResized(true)

    const onMove = (ev: PointerEvent) => {
      // Drag up → taller, drag down → shorter.
      const dy = startY - ev.clientY
      const clamped = Math.max(120, Math.min(maxHeight, Math.round(startHeight + dy)))
      setPreviewHeight(clamped)
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const updateDockHeight = () => {
    if (!dockEl || !footerEl) return
    const h = dockEl.offsetHeight + footerEl.offsetHeight
    document.documentElement.style.setProperty('--dock-height', `${h}px`)
  }

  const handleDockRef = (el: HTMLElement) => { dockEl = el }
  const handleFooterRef = (el: HTMLElement) => { footerEl = el }

  onMount(() => {
    if (typeof window === 'undefined') return

    const fromHash = decodeFromHash(window.location.hash)
    if (fromHash) {
      // A shared spec is the user's content — keep it and don't auto-swap the
      // sample when the theme is changed.
      setSpec(fromHash)
      markEdited()
    } else {
      // New session (no shared spec in the URL): land on a random preset and
      // show that theme's brand-fitting default koma. Done before data-ready
      // so the first painted frame already shows the chosen theme + sample.
      setSpec(sampleSpec(randomThemeId()))
    }

    requestAnimationFrame(() => appEl?.setAttribute('data-ready', ''))

    // Auto-expand the preview as soon as playback starts.
    const onTimeUpdate = (e: Event) => {
      if ((e as CustomEvent).detail?.playing) setPreviewExpanded(true)
    }
    window.addEventListener('koma:timeupdate', onTimeUpdate)
    onCleanup(() => window.removeEventListener('koma:timeupdate', onTimeUpdate))

    // Dock height tracking
    updateDockHeight()
    window.addEventListener('resize', updateDockHeight)
    onCleanup(() => window.removeEventListener('resize', updateDockHeight))

    if (dockEl) {
      const observer = new ResizeObserver(updateDockHeight)
      observer.observe(dockEl)
      onCleanup(() => observer.disconnect())
    }

    // Debounced URL persistence
    let timer: ReturnType<typeof setTimeout> | null = null
    const persist = () => {
      const hash = encodeToHash(spec())
      const url = `${window.location.pathname}${window.location.search}#${hash}`
      window.history.replaceState(null, '', url)
    }
    createEffect(() => {
      void spec().frames.length
      void spec().language
      void spec().width
      void spec().theme
      void spec().frames.map(f => f.code).join(' ')
      if (timer) clearTimeout(timer)
      timer = setTimeout(persist, 250)
    })
    onCleanup(() => { if (timer) clearTimeout(timer) })
  })

  return (
    <div className="koma-app" ref={(el: HTMLElement) => { appEl = el }}>
      <AppHeader spec={spec()} />

      <div className="koma-editors-wrapper">
        <div
          className="koma-editors-handle koma-editors-handle--left"
          onPointerDown={(e: PointerEvent) => handleEdgeDrag(e, 'left')}
        />
        <section className="koma-editors" aria-label="Frame editors" style={editorStyle()}>
          {spec().frames.map((frame, i) => (
            <FrameEditor
              key={frame.id}
              frame={frame}
              language={frameLanguage(frame, spec())}
              shikiTheme={theme().shikiTheme}
              editorBg={theme().render.codeBackground}
              editorFg={theme().render.textColor}
              editorCaret={theme().render.cursorColor}
              index={i}
              total={spec().frames.length}
              selected={selectedFrameId() === frame.id}
              onCode={code => { markEdited(); setSpec(s => updateFrame(s, frame.id, { code })) }}
              onLanguage={(language: Language | undefined) => { markEdited(); setSpec(s => updateFrame(s, frame.id, { language })) }}
              onRemove={() => { markEdited(); setSpec(s => removeFrame(s, frame.id)) }}
            />
          ))}

          <button
            type="button"
            className="koma-add-frame"
            onClick={() => { markEdited(); setSpec(s => addFrame(s)) }}
            aria-label="Add frame"
          >
            +
          </button>
        </section>
        <div
          className="koma-editors-handle koma-editors-handle--right"
          onPointerDown={(e: PointerEvent) => handleEdgeDrag(e, 'right')}
        />
      </div>

      <div
        className="koma-preview-dock"
        ref={handleDockRef}
        data-resized={previewResized() ? '' : undefined}
        data-collapsed={previewExpanded() ? undefined : ''}
        style={`--preview-height:${previewHeight()}px`}
      >
        <div
          className="koma-preview-resize"
          role="separator"
          aria-label="Resize preview height"
          aria-orientation="horizontal"
          onPointerDown={(e: PointerEvent) => handlePreviewResize(e)}
        />
        <div className="koma-preview-head" style={`max-width:${contentMaxWidth()}px`}>
          <ThemeBar
            theme={spec().theme}
            onThemeChange={applyTheme}
          />
          <button
            type="button"
            className="koma-preview-toggle"
            aria-label={previewExpanded() ? 'Hide preview' : 'Show preview'}
            aria-expanded={previewExpanded() ? 'true' : 'false'}
            onClick={() => setPreviewExpanded(v => !v)}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <aside className="koma-preview" aria-label="Preview" style={`max-width:${contentMaxWidth()}px`}>
          <Player spec={spec()} expanded={previewExpanded()} />
        </aside>
      </div>

      <footer className="koma-timeline-footer" ref={handleFooterRef}>
        <TimelineBar
          frames={spec().frames}
          selectedFrameId={selectedFrameId()}
          onLayout={(holds) => {
            markEdited()
            setSpec(s => {
              let updated = s
              for (const h of holds) {
                updated = updateFrame(updated, h.id, { hold: h.hold })
              }
              return updated
            })
          }}
          onTransitionLayout={(toFrameId, duration) => {
            markEdited()
            setSpec(s => updateFrame(s, toFrameId, { transition: { duration } }))
          }}
          onSelect={setSelectedFrameId}
        />
      </footer>
    </div>
  )
}
