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
    createEffect(() => {
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const segments = el.querySelectorAll('[data-timeline-segment]') as NodeListOf<HTMLElement>

      segments.forEach((seg, i) => {
        const pct = (holdOf(frames[i]) / totalHold) * 100
        seg.style.flexBasis = `${pct}%`
        seg.style.flexGrow = '0'
        seg.style.flexShrink = '0'
      })
    })
  }

  const handleDrag = (handleIndex: number, e: MouseEvent) => {
    e.preventDefault()
    const bar = (e.currentTarget as HTMLElement).closest('.koma-timeline') as HTMLElement
    if (!bar) return
    const barRect = bar.getBoundingClientRect()
    const frames = props.frames
    const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)

    const onMove = (ev: MouseEvent) => {
      const ratio = Math.max(0, Math.min(1, (ev.clientX - barRect.left) / barRect.width))
      const cursorMs = ratio * totalHold
      let acc = 0
      for (let k = 0; k < handleIndex; k++) {
        acc += holdOf(frames[k])
      }
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
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="koma-timeline" ref={handleMount}>
      {props.frames.map((frame, i) => (
        <div
          key={frame.id}
          className="koma-timeline-segment"
          data-timeline-segment
          data-key={frame.id}
        >
          <span className="koma-timeline-label">{i + 1}</span>
          {i < props.frames.length - 1 && (
            <div
              className="koma-timeline-handle"
              onMouseDown={(e: MouseEvent) => handleDrag(i, e)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
