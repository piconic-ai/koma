'use client'

import { createEffect } from '@barefootjs/client'

const HOLD_PER_LINE_MS = 600
const MIN_HOLD_MS = 2500

function autoHold(code: string): number {
  const lines = code.split('\n').length
  return Math.max(MIN_HOLD_MS, lines * HOLD_PER_LINE_MS)
}

function holdOf(frame: { code: string; hold?: number }): number {
  return frame.hold ?? autoHold(frame.code)
}

interface TimelineBarProps {
  frames: Array<{ id: string; code: string; hold?: number }>
  onLayout: (holds: Array<{ id: string; hold: number }>) => void
}

export function TimelineBar(props: TimelineBarProps) {
  const handleMount = (el: HTMLElement) => {
    const applySizes = () => {
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const panels = el.querySelectorAll('[data-timeline-panel]') as NodeListOf<HTMLElement>
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

    el.addEventListener('pointerdown', (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-timeline-handle]') as HTMLElement | null
      if (!handle) return
      e.preventDefault()
      handle.setPointerCapture(e.pointerId)
      handle.setAttribute('data-state', 'drag')

      const handleIndex = Number(handle.getAttribute('data-timeline-handle'))
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const barRect = el.getBoundingClientRect()

      const onMove = (ev: PointerEvent) => {
        const ratio = Math.max(0, Math.min(1, (ev.clientX - barRect.left) / barRect.width))
        const cursorMs = ratio * totalHold
        let acc = 0
        for (let k = 0; k < handleIndex; k++) acc += holdOf(frames[k])
        const combined = holdOf(frames[handleIndex]) + holdOf(frames[handleIndex + 1])
        const minHold = 200
        let newThis = Math.round(cursorMs - acc)
        newThis = Math.max(minHold, Math.min(combined - minHold, newThis))
        const newNext = combined - newThis

        props.onLayout([
          { id: frames[handleIndex].id, hold: newThis },
          { id: frames[handleIndex + 1].id, hold: newNext },
        ])
      }

      const onUp = () => {
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        handle.setAttribute('data-state', 'idle')
      }

      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    })
  }

  return (
    <div className="koma-timeline" ref={handleMount}>
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
    </div>
  )
}
