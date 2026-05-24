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

    // Segment handle drag (redistribute between adjacent frames)
    bar.addEventListener('pointerdown', (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-timeline-handle]') as HTMLElement | null
      if (!handle) return
      e.preventDefault()
      handle.setPointerCapture(e.pointerId)
      handle.setAttribute('data-state', 'drag')

      const handleIndex = Number(handle.getAttribute('data-timeline-handle'))
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const barRect = bar.getBoundingClientRect()

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

    // Right-edge drag (scale total duration)
    const edgeHandle = el.querySelector('[data-timeline-edge]') as HTMLElement
    if (!edgeHandle) return

    edgeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault()
      edgeHandle.setPointerCapture(e.pointerId)
      edgeHandle.setAttribute('data-state', 'drag')

      const frames = props.frames
      const startHolds = frames.map(f => holdOf(f))
      const startWidth = bar.getBoundingClientRect().width
      const wrapperRect = el.getBoundingClientRect()
      const barLeft = bar.getBoundingClientRect().left

      const onMove = (ev: PointerEvent) => {
        const newWidth = Math.max(60, ev.clientX - barLeft)
        const scale = newWidth / startWidth
        const holds = frames.map((f, i) => ({
          id: f.id,
          hold: Math.max(200, Math.round(startHolds[i] * scale)),
        }))
        bar.style.width = `${Math.min(100, (newWidth / wrapperRect.width) * 100)}%`
        props.onLayout(holds)
      }

      const onUp = () => {
        edgeHandle.removeEventListener('pointermove', onMove)
        edgeHandle.removeEventListener('pointerup', onUp)
        edgeHandle.setAttribute('data-state', 'idle')
      }

      edgeHandle.addEventListener('pointermove', onMove)
      edgeHandle.addEventListener('pointerup', onUp)
    })
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
