'use client'

import { createEffect } from '@barefootjs/client'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable'

const HOLD_PER_LINE_MS = 600
const MIN_HOLD_MS = 2500
const TRANSITION_MS = 400

function autoHold(code: string): number {
  const lines = code.split('\n').length
  return Math.max(MIN_HOLD_MS, lines * HOLD_PER_LINE_MS)
}

function holdOf(frame: { code: string; hold?: number }): number {
  return frame.hold ?? autoHold(frame.code)
}

function formatDuration(ms: number): string {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

interface TimelineBarProps {
  frames: Array<{ id: string; code: string; hold?: number }>
  onLayout: (holds: Array<{ id: string; hold: number }>) => void
  onSelect: (frameId: string) => void
  elapsedMs: number
  totalMs: number
  playing: boolean
  onSeek: (ms: number) => void
  onTogglePlay: () => void
}

export function TimelineBar(props: TimelineBarProps) {
  const frames = props.frames
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)

  const onLayout = (sizes: number[]) => {
    const holds = frames.map((f, i) => ({
      id: f.id,
      hold: Math.max(50, Math.round((sizes[i] / 100) * totalHold)),
    }))
    props.onLayout(holds)
  }

  const handleMount = (el: HTMLElement) => {
    // Play button - event delegation
    el.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-play-btn]')) {
        e.stopPropagation()
        props.onTogglePlay()
        return
      }
      if ((e.target as HTMLElement).closest('[data-slot="resizable-handle"]')) return
      if ((e.target as HTMLElement).closest('[data-timeline-edge]')) return
      const group = el.querySelector('[data-slot="resizable-panel-group"]') as HTMLElement
      if (!group) return

      const panel = (e.target as HTMLElement).closest('[data-slot="resizable-panel"]') as HTMLElement | null
      if (panel) {
        const idx = Array.from(group.querySelectorAll('[data-slot="resizable-panel"]')).indexOf(panel)
        if (idx >= 0 && props.frames[idx]) {
          props.onSelect(props.frames[idx].id)
        }
      }

      if (props.totalMs > 0) {
        const rect = group.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        props.onSeek(Math.round(ratio * props.totalMs))
      }
    })

    // Play button icon
    createEffect(() => {
      const playBtn = el.querySelector('[data-play-btn]') as HTMLElement
      if (playBtn) {
        playBtn.setAttribute('aria-label', props.playing ? 'Pause' : 'Play')
        playBtn.innerHTML = props.playing
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
      }
    })

    // Playhead
    createEffect(() => {
      const playhead = el.querySelector('[data-playhead]') as HTMLElement
      if (playhead) {
        const pct = props.totalMs > 0 ? (props.elapsedMs / props.totalMs) * 100 : 0
        playhead.style.left = `${pct}%`
      }
    })

    // Right-edge drag (scale total duration)
    const edgeHandle = el.querySelector('[data-timeline-edge]') as HTMLElement
    if (!edgeHandle) return

    edgeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      edgeHandle.setPointerCapture(e.pointerId)
      edgeHandle.setAttribute('data-state', 'drag')

      const currentFrames = props.frames
      const startHolds = currentFrames.map(f => holdOf(f))
      const group = el.querySelector('[data-slot="resizable-panel-group"]') as HTMLElement
      const startWidth = group.getBoundingClientRect().width
      const groupLeft = group.getBoundingClientRect().left

      const minHold = 50
      const minTotal = currentFrames.length * minHold

      const onMove = (ev: PointerEvent) => {
        const newWidth = Math.max(60, ev.clientX - groupLeft)
        const scale = newWidth / startWidth
        const holds = currentFrames.map((f, i) => ({
          id: f.id,
          hold: Math.max(minHold, Math.round(startHolds[i] * scale)),
        }))
        const actualTotal = holds.reduce((s, h) => s + h.hold, 0)
        const atMin = actualTotal <= minTotal

        group.style.maxWidth = `${(newWidth / el.getBoundingClientRect().width) * 100}%`
        group.setAttribute('data-at-min', atMin ? '' : null as any)
        props.onLayout(holds)
      }

      const onUp = () => {
        edgeHandle.removeEventListener('pointermove', onMove)
        edgeHandle.removeEventListener('pointerup', onUp)
        edgeHandle.setAttribute('data-state', 'idle')
        group.removeAttribute('data-at-min')
      }

      edgeHandle.addEventListener('pointermove', onMove)
      edgeHandle.addEventListener('pointerup', onUp)
    })
  }

  const totalRef = (el: HTMLElement) => {
    createEffect(() => {
      const totalHoldMs = props.frames.reduce((sum, f) => sum + holdOf(f), 0)
      const transitionsMs = Math.max(0, props.frames.length - 1) * TRANSITION_MS
      const total = totalHoldMs + transitionsMs
      el.textContent = Number.isFinite(total) ? formatDuration(total) : '—'
    })
  }

  const children = frames.flatMap((frame, i) => {
    const pct = (holdOf(frame) / totalHold) * 100
    const panel = (
      <ResizablePanel
        key={frame.id}
        defaultSize={pct}
        minSize={3}
        className="koma-timeline-segment"
      >
        <span className="koma-timeline-label">{i + 1}</span>
      </ResizablePanel>
    )
    if (i === 0) return [panel]
    return [<ResizableHandle key={`h-${frame.id}`} withHandle />, panel]
  })

  return (
    <div className="koma-timeline-wrapper" ref={handleMount}>
      <button
        type="button"
        className="koma-timeline-play"
        data-play-btn
      />
      <ResizablePanelGroup
        direction="horizontal"
        className="koma-timeline"
        onLayout={onLayout}
      >
        {children}
        <div data-playhead className="koma-timeline-playhead" />
        <div
          data-timeline-edge
          data-state="idle"
          className="koma-timeline-edge"
        />
      </ResizablePanelGroup>
      <span className="koma-timeline-total" ref={totalRef} />
    </div>
  )
}
