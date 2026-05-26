'use client'

import { createSignal, createEffect } from '@barefootjs/client'
import {
  holdOf,
  formatDuration,
  elapsedToHoldRatio,
  holdRatioToElapsed,
  computeBarWidth,
  clientXToRatio,
  computeSegmentDrag,
  TRANSITION_MS,
} from '../src/lib/timelinebar/logic'

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

// ── Generic drag helper ──────────────────────────────────
function setupDrag(
  el: HTMLElement,
  callbacks: {
    onMove: (ev: PointerEvent) => void
    onEnd: () => void
  },
) {
  el.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    el.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => callbacks.onMove(ev)
    const cleanup = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', cleanup)
      el.removeEventListener('pointercancel', cleanup)
      callbacks.onEnd()
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', cleanup)
    el.addEventListener('pointercancel', cleanup)
  })
}

export function TimelineBar(props: TimelineBarProps) {
  const [atMin, setAtMin] = createSignal(false)
  const [frames, setFrames] = createSignal(props.frames)
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [playheadPct, setPlayheadPct] = createSignal(0)
  const [isDragging, setIsDragging] = createSignal(false)
  const [maxWidthPct, setMaxWidthPct] = createSignal<number | null>(null)
  const [edgeDragging, setEdgeDragging] = createSignal(false)

  createEffect(() => setFrames(props.frames))

  const totalHold = () => frames().reduce((sum, f) => sum + holdOf(f), 0)
  const totalDuration = () => totalHold() + Math.max(0, frames().length - 1) * TRANSITION_MS

  const barStyle = () => {
    const mw = maxWidthPct()
    return mw !== null ? `max-width:${mw}%` : ''
  }

  // ── Event listeners (registered once in handleMount) ───
  const handleMount = (el: HTMLElement) => {
    const bar = el.querySelector('[data-timeline-bar]') as HTMLElement
    const playhead = bar?.querySelector('[data-playhead]') as HTMLElement

    // Timeupdate → signals (registered once, no leak)
    window.addEventListener('koma:timeupdate', (e: Event) => {
      const d = (e as CustomEvent).detail
      setIsPlaying(d.playing)
      if (!isDragging()) {
        setPlayheadPct(elapsedToHoldRatio(d.elapsed, props.frames))
      }
    })

    // Clear at-min on any click
    document.addEventListener('click', () => setAtMin(false))

    // Playhead drag
    if (playhead) {
      setupDrag(playhead, {
        onMove: (ev) => {
          setIsDragging(true)
          const ratio = clientXToRatio(ev.clientX, bar.getBoundingClientRect())
          setPlayheadPct(ratio * 100)
          if (props.totalMs > 0) {
            props.onSeek(Math.round(holdRatioToElapsed(ratio, props.frames)))
          }
        },
        onEnd: () => setIsDragging(false),
      })
    }

    // Segment handle drag (delegated)
    if (bar) {
      bar.addEventListener('pointerdown', (e: PointerEvent) => {
        const handle = (e.target as HTMLElement).closest('[data-seg-handle]') as HTMLElement
        if (!handle) return
        e.preventDefault()
        e.stopPropagation()
        handle.setPointerCapture(e.pointerId)

        const idx = Number(handle.getAttribute('data-seg-handle'))
        const barRect = bar.getBoundingClientRect()

        const onMove = (ev: PointerEvent) => {
          const ratio = clientXToRatio(ev.clientX, barRect)
          props.onLayout(computeSegmentDrag(ratio, idx, props.frames))
        }
        const cleanup = () => {
          handle.removeEventListener('pointermove', onMove)
          handle.removeEventListener('pointerup', cleanup)
          handle.removeEventListener('pointercancel', cleanup)
        }
        handle.addEventListener('pointermove', onMove)
        handle.addEventListener('pointerup', cleanup)
        handle.addEventListener('pointercancel', cleanup)
      })
    }

    // Edge drag
    const edgeHandle = bar?.querySelector('[data-timeline-edge]') as HTMLElement
    if (edgeHandle) {
      setupDrag(edgeHandle, {
        onMove: (ev) => {
          setEdgeDragging(true)
          const startHolds = props.frames.map(f => holdOf(f))
          const frameIds = props.frames.map(f => f.id)
          const barLeft = bar.getBoundingClientRect().left
          const startWidth = bar.getBoundingClientRect().width
          const wrapperWidth = el.getBoundingClientRect().width
          const newWidth = Math.max(60, ev.clientX - barLeft)
          const result = computeBarWidth({ newWidth, startWidth, wrapperWidth, startHolds, frameIds })

          if (result.blocked) {
            setAtMin(true)
            return
          }

          setAtMin(result.atMin)
          if (!result.atMin) {
            setMaxWidthPct(result.maxWidthPct)
          }
          props.onLayout(result.holds)
        },
        onEnd: () => {
          setEdgeDragging(false)
          setAtMin(false)
        },
      })
    }
  }

  return (
    <div className="koma-timeline-wrapper" ref={handleMount}>
      <button
        type="button"
        className="koma-timeline-play"
        aria-label={isPlaying() ? 'Pause' : 'Play'}
        onClick={() => props.onTogglePlay()}
      >
        {isPlaying() ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
        )}
      </button>
      <div
        className={`koma-timeline ${atMin() ? 'koma-timeline--at-min' : ''}`}
        data-timeline-bar
        style={barStyle()}
      >
        {frames().map((frame, i) => (
          <div key={frame.id} data-key={frame.id} style="display:contents">
            {i > 0 && (
              <div
                data-seg-handle={i - 1}
                className="koma-timeline-handle-bar"
              />
            )}
            <div
              className="koma-timeline-segment"
              style={`flex-basis:${totalHold() > 0 ? (holdOf(frame) / totalHold()) * 100 : 0}%;flex-grow:0;flex-shrink:0`}
              onClick={() => {
                props.onSelect(frame.id)
                if (totalHold() > 0 && props.totalMs > 0) {
                  props.onSeek(Math.round(holdRatioToElapsed(i / frames().length, frames())))
                }
              }}
            >
              <span className="koma-timeline-label">{i + 1}</span>
            </div>
          </div>
        ))}
        <div
          data-playhead
          className="koma-timeline-playhead"
          style={`left:${playheadPct()}%`}
        />
        <div
          data-timeline-edge
          className={`koma-timeline-edge ${edgeDragging() ? 'koma-timeline-edge--dragging' : ''}`}
        />
      </div>
      <span className="koma-timeline-total">
        {Number.isFinite(totalDuration()) ? formatDuration(totalDuration()) : '—'}
      </span>
    </div>
  )
}
