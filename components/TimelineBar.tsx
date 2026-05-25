'use client'

import { createSignal, createEffect } from '@barefootjs/client'
import {
  holdOf,
  formatDuration,
  elapsedToHoldRatio,
  holdRatioToElapsed,
  computeBarWidth,
  TRANSITION_MS,
  MIN_HOLD,
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

const PLAY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
const PAUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'

export function TimelineBar(props: TimelineBarProps) {
  const [atMin, setAtMin] = createSignal(false)
  const [frames, setFrames] = createSignal(props.frames)

  createEffect(() => {
    setFrames(props.frames)
  })

  const totalHold = () => frames().reduce((sum, f) => sum + holdOf(f), 0)

  const totalDuration = () => {
    const h = totalHold()
    const t = Math.max(0, props.frames.length - 1) * TRANSITION_MS
    return h + t
  }

  const handleMount = (el: HTMLElement) => {
    const bar = el.querySelector('[data-timeline-bar]') as HTMLElement
    const playhead = el.querySelector('[data-playhead]') as HTMLElement
    const playBtn = el.querySelector('[data-play-btn]') as HTMLElement

    // ── Play button click ────────────────────────────────
    el.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-play-btn]')) {
        e.stopPropagation()
        props.onTogglePlay()
      }
    })

    // ── Clear at-min on any click ────────────────────────
    document.addEventListener('click', () => setAtMin(false))

    // ── Timeupdate: playhead + play icon ─────────────────
    let isDraggingPlayhead = false

    const onTimeUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (playBtn) playBtn.innerHTML = d.playing ? PAUSE_SVG : PLAY_SVG
      if (playhead && !isDraggingPlayhead) {
        playhead.style.left = `${elapsedToHoldRatio(d.elapsed, props.frames)}%`
      }
    }
    const prev = (el as any).__komaTimeUpdate as typeof onTimeUpdate | undefined
    if (prev) window.removeEventListener('koma:timeupdate', prev)
    ;(el as any).__komaTimeUpdate = onTimeUpdate
    window.addEventListener('koma:timeupdate', onTimeUpdate)

    // ── Playhead drag ────────────────────────────────────
    if (playhead) {
      playhead.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        playhead.setPointerCapture(e.pointerId)
        isDraggingPlayhead = true

        const onMove = (ev: PointerEvent) => {
          const barRect = bar.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (ev.clientX - barRect.left) / barRect.width))
          playhead.style.left = `${ratio * 100}%`
          if (props.totalMs > 0) {
            props.onSeek(Math.round(holdRatioToElapsed(ratio, props.frames)))
          }
        }

        const cleanup = () => {
          playhead.removeEventListener('pointermove', onMove)
          playhead.removeEventListener('pointerup', cleanup)
          playhead.removeEventListener('pointercancel', cleanup)
          isDraggingPlayhead = false
        }

        playhead.addEventListener('pointermove', onMove)
        playhead.addEventListener('pointerup', cleanup)
        playhead.addEventListener('pointercancel', cleanup)
      })
    }

    // ── Segment handle drag ──────────────────────────────
    bar.addEventListener('pointerdown', (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-seg-handle]') as HTMLElement
      if (!handle) return
      e.preventDefault()
      e.stopPropagation()
      handle.setPointerCapture(e.pointerId)
      handle.setAttribute('data-state', 'drag')

      const idx = Number(handle.getAttribute('data-seg-handle'))
      const frames = props.frames
      const th = totalHold()
      const barRect = bar.getBoundingClientRect()

      const onMove = (ev: PointerEvent) => {
        const ratio = Math.max(0, Math.min(1, (ev.clientX - barRect.left) / barRect.width))
        const cursorMs = ratio * th
        let acc = 0
        for (let k = 0; k < idx; k++) acc += holdOf(frames[k])
        const combined = holdOf(frames[idx]) + holdOf(frames[idx + 1])
        let newThis = Math.round(cursorMs - acc)
        newThis = Math.max(MIN_HOLD, Math.min(combined - MIN_HOLD, newThis))
        props.onLayout([
          { id: frames[idx].id, hold: newThis },
          { id: frames[idx + 1].id, hold: combined - newThis },
        ])
      }

      const cleanup = () => {
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', cleanup)
        handle.removeEventListener('pointercancel', cleanup)
        handle.setAttribute('data-state', 'idle')
      }

      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', cleanup)
      handle.addEventListener('pointercancel', cleanup)
    })


    // ── Right-edge drag ──────────────────────────────────
    const edgeHandle = bar.querySelector('[data-timeline-edge]') as HTMLElement
    if (!edgeHandle) return

    edgeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      edgeHandle.setPointerCapture(e.pointerId)
      edgeHandle.setAttribute('data-state', 'drag')

      const frames = props.frames
      const startHolds = frames.map(f => holdOf(f))
      const frameIds = frames.map(f => f.id)
      const barLeft = bar.getBoundingClientRect().left
      const startWidth = bar.getBoundingClientRect().width
      const wrapperWidth = el.getBoundingClientRect().width

      const onMove = (ev: PointerEvent) => {
        const newWidth = Math.max(60, ev.clientX - barLeft)
        const result = computeBarWidth({ newWidth, startWidth, wrapperWidth, startHolds, frameIds })

        if (result.blocked) {
          setAtMin(true)
          return
        }

        setAtMin(result.atMin)
        if (!result.atMin) {
          if (result.maxWidthPct !== null) {
            bar.style.maxWidth = `${result.maxWidthPct}%`
          } else {
            bar.style.maxWidth = ''
          }
        }
        props.onLayout(result.holds)
      }

      const cleanup = () => {
        edgeHandle.removeEventListener('pointermove', onMove)
        edgeHandle.removeEventListener('pointerup', cleanup)
        edgeHandle.removeEventListener('pointercancel', cleanup)
        edgeHandle.setAttribute('data-state', 'idle')
        setAtMin(false)
      }

      edgeHandle.addEventListener('pointermove', onMove)
      edgeHandle.addEventListener('pointerup', cleanup)
      edgeHandle.addEventListener('pointercancel', cleanup)
    })
  }

  return (
    <div className="koma-timeline-wrapper" ref={handleMount}>
      <button type="button" className="koma-timeline-play" data-play-btn />
      <div
        className={`koma-timeline ${atMin() ? 'koma-timeline--at-min' : ''}`}
        data-timeline-bar
      >
        {frames().map((frame, i) => (
          <div key={frame.id} data-key={frame.id} style="display:contents">
            {i > 0 && (
              <div
                data-seg-handle={i - 1}
                data-state="idle"
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
        <div data-playhead className="koma-timeline-playhead" />
        <div data-timeline-edge data-state="idle" className="koma-timeline-edge" />
      </div>
      <span className="koma-timeline-total">
        {Number.isFinite(totalDuration()) ? formatDuration(totalDuration()) : '—'}
      </span>
    </div>
  )
}
