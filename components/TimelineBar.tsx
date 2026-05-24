'use client'

import { createEffect } from '@barefootjs/client'

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
}

export function TimelineBar(props: TimelineBarProps) {
  const handleMount = (el: HTMLElement) => {
    const bar = el.querySelector('[data-timeline-bar]') as HTMLElement
    if (!bar) return

    const applySizes = () => {
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const panels = bar.querySelectorAll('[data-timeline-panel]') as NodeListOf<HTMLElement>
      panels.forEach((panel, i) => {
        if (!frames[i]) return
        const pct = (holdOf(frames[i]) / totalHold) * 100
        panel.style.flexBasis = `${pct}%`
        panel.style.flexGrow = '0'
        panel.style.flexShrink = '0'
      })
    }

    createEffect(() => {
      void props.frames.map(f => f.hold)
      void props.frames.map(f => f.code)
      void props.frames.length
      applySizes()
    })

    let activeHandle: { type: 'segment'; index: number } | { type: 'edge' } | null = null
    let dragState: { startX: number; frames: typeof props.frames; startHolds: number[]; barWidth: number; wrapperWidth: number; barLeft: number } | null = null

    bar.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-timeline-handle]')) return
      if ((e.target as HTMLElement).closest('[data-timeline-edge]')) return
      const panel = (e.target as HTMLElement).closest('[data-timeline-panel]') as HTMLElement | null
      if (!panel) return
      const frameId = panel.getAttribute('data-key')
      if (frameId) props.onSelect(frameId)
    })

    const onPointerDown = (e: PointerEvent) => {
      const segHandle = (e.target as HTMLElement).closest('[data-timeline-handle]') as HTMLElement | null
      const edgeHandle = (e.target as HTMLElement).closest('[data-timeline-edge]') as HTMLElement | null

      if (!segHandle && !edgeHandle) return
      e.preventDefault()

      const frames = props.frames
      const startHolds = frames.map(f => holdOf(f))
      const barRect = bar.getBoundingClientRect()
      const wrapperRect = el.getBoundingClientRect()

      dragState = {
        startX: e.clientX,
        frames,
        startHolds,
        barWidth: barRect.width,
        wrapperWidth: wrapperRect.width,
        barLeft: barRect.left,
      }

      if (segHandle) {
        activeHandle = { type: 'segment', index: Number(segHandle.getAttribute('data-timeline-handle')) }
        segHandle.setAttribute('data-state', 'drag')
      } else {
        activeHandle = { type: 'edge' }
        edgeHandle!.setAttribute('data-state', 'drag')
      }

      el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!activeHandle || !dragState) return

      if (activeHandle.type === 'segment') {
        const totalHold = dragState.startHolds.reduce((sum, h) => sum + h, 0)
        const ratio = Math.max(0, Math.min(1, (e.clientX - dragState.barLeft) / dragState.barWidth))
        const cursorMs = ratio * totalHold
        const idx = activeHandle.index
        let acc = 0
        for (let k = 0; k < idx; k++) acc += dragState.startHolds[k]
        const combined = dragState.startHolds[idx] + dragState.startHolds[idx + 1]
        const minHold = 200
        let newThis = Math.round(cursorMs - acc)
        newThis = Math.max(minHold, Math.min(combined - minHold, newThis))
        const newNext = combined - newThis

        props.onLayout([
          { id: dragState.frames[idx].id, hold: newThis },
          { id: dragState.frames[idx + 1].id, hold: newNext },
        ])
      } else {
        const newWidth = Math.max(60, e.clientX - dragState.barLeft)
        const scale = newWidth / dragState.barWidth
        const holds = dragState.frames.map((f, i) => ({
          id: f.id,
          hold: Math.max(200, Math.round(dragState!.startHolds[i] * scale)),
        }))
        bar.style.maxWidth = `${(newWidth / dragState.wrapperWidth) * 100}%`
        props.onLayout(holds)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!activeHandle) return
      if (activeHandle.type === 'segment') {
        const h = bar.querySelector(`[data-timeline-handle="${activeHandle.index}"]`) as HTMLElement
        if (h) h.setAttribute('data-state', 'idle')
      } else {
        const h = bar.querySelector('[data-timeline-edge]') as HTMLElement
        if (h) h.setAttribute('data-state', 'idle')
      }
      activeHandle = null
      dragState = null
      el.releasePointerCapture(e.pointerId)
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
  }

  const totalRef = (el: HTMLElement) => {
    createEffect(() => {
      const totalHoldMs = props.frames.reduce((sum, f) => sum + holdOf(f), 0)
      const transitionsMs = Math.max(0, props.frames.length - 1) * TRANSITION_MS
      el.textContent = formatDuration(totalHoldMs + transitionsMs)
    })
  }

  return (
    <div className="koma-timeline-wrapper" ref={handleMount}>
      <div className="koma-timeline" data-timeline-bar>
        {props.frames.map((frame, i) => (
          <div
            key={frame.id}
            data-timeline-panel
            data-key={frame.id}
            className="koma-timeline-segment"
          >
            <span className="koma-timeline-label">{i + 1}</span>
            {i < props.frames.length - 1 && (
              <div
                data-timeline-handle={i}
                data-state="idle"
                className="koma-timeline-handle"
              />
            )}
          </div>
        ))}
        <div
          data-timeline-edge
          data-state="idle"
          className="koma-timeline-edge"
        />
      </div>
      <span className="koma-timeline-total" ref={totalRef} />
    </div>
  )
}
