'use client'

import { createEffect, createMemo, createSignal, onCleanup, onMount } from '@barefootjs/client'
import { Player } from '@/components/Player'
import { FrameEditor } from '@/components/FrameEditor'
import { AppHeader } from '@/components/AppHeader'
import { TimelineBar } from '@/components/TimelineBar'
import {
  addFrame,
  removeFrame,
  setLanguage,
  updateFrame,
} from '../src/model/spec'
import type { CanvasWidth, Language, Spec } from '../src/model/types'

import { decodeFromHash, encodeToHash } from '../src/state/url'

interface AppProps {
  initialSpec: Spec
}

// @bf-ignore props-destructuring
export function App({ initialSpec }: AppProps) {
  const savedHash = typeof window !== 'undefined' ? window.location.hash : ''
  const [spec, setSpec] = createSignal<Spec>(initialSpec)
  const [selectedFrameId, setSelectedFrameId] = createSignal<string | null>(null)

  let appEl: HTMLElement | null = null
  let dockEl: HTMLElement | null = null
  let footerEl: HTMLElement | null = null

  const editorWidth = createMemo(() => spec().width ?? 1080)
  const contentMaxWidth = () => Math.round(editorWidth() * 0.64)
  const editorStyle = () => `max-width:${contentMaxWidth()}px`

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

  const updateDockHeight = () => {
    if (!dockEl || !footerEl) return
    const h = dockEl.offsetHeight + footerEl.offsetHeight
    document.documentElement.style.setProperty('--dock-height', `${h}px`)
  }

  const handleDockRef = (el: HTMLElement) => { dockEl = el }
  const handleFooterRef = (el: HTMLElement) => { footerEl = el }

  onMount(() => {
    if (typeof window === 'undefined') return

    const fromHash = decodeFromHash(savedHash)
    if (fromHash) {
      // Reuse SSR frame ids so mapArray can match keys during hydration.
      fromHash.frames.forEach((f, i) => {
        if (i < initialSpec.frames.length) f.id = initialSpec.frames[i].id
      })
      setSpec(fromHash)
      // Workaround: mapArray hydration doesn't remove orphaned SSR nodes.
      // With matching keys, orphans are always at the end.
      if (fromHash.frames.length < initialSpec.frames.length) {
        requestAnimationFrame(() => {
          const editors = appEl?.querySelectorAll('.koma-frame-editor')
          if (editors) {
            for (let i = editors.length - 1; i >= fromHash.frames.length; i--) {
              editors[i].remove()
            }
          }
        })
      }
    }

    requestAnimationFrame(() => appEl?.setAttribute('data-ready', ''))

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
      void spec().frames.map(f => f.code).join(' ')
      if (timer) clearTimeout(timer)
      timer = setTimeout(persist, 250)
    })
    onCleanup(() => { if (timer) clearTimeout(timer) })
  })

  return (
    <div className="koma-app" ref={(el: HTMLElement) => { appEl = el }}>
      <AppHeader
        language={spec().language}
        spec={spec()}
        onLanguageChange={(v: Language) => setSpec(s => setLanguage(s, v))}
      />

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
              language={spec().language}
              index={i}
              total={spec().frames.length}
              selected={selectedFrameId() === frame.id}
              onCode={code => setSpec(s => updateFrame(s, frame.id, { code }))}
              onRemove={() => setSpec(s => removeFrame(s, frame.id))}
            />
          ))}

          <button
            type="button"
            className="koma-add-frame"
            onClick={() => setSpec(s => addFrame(s))}
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

      <div className="koma-preview-dock" ref={handleDockRef}>
        <aside className="koma-preview" aria-label="Preview" style={`max-width:${contentMaxWidth()}px`}>
          <Player spec={spec()} />
        </aside>
      </div>

      <footer className="koma-timeline-footer" ref={handleFooterRef}>
        <TimelineBar
          frames={spec().frames}
          selectedFrameId={selectedFrameId()}
          onLayout={(holds) => {
            setSpec(s => {
              let updated = s
              for (const h of holds) {
                updated = updateFrame(updated, h.id, { hold: h.hold })
              }
              return updated
            })
          }}
          onSelect={setSelectedFrameId}
        />
      </footer>
    </div>
  )
}
