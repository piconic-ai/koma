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
  elapsedMs: number
  totalMs: number
  playing: boolean
  onSeek: (ms: number) => void
  onTogglePlay: () => void
}

export function TimelineBar(props: TimelineBarProps) {
  const handleMount = (el: HTMLElement) => {
    const bar = el.querySelector('[data-timeline-bar]') as HTMLElement
    const playhead = el.querySelector('[data-playhead]') as HTMLElement
    const totalLabel = el.querySelector('[data-total]') as HTMLElement

    // Play button
    el.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-play-btn]')) {
        e.stopPropagation()
        props.onTogglePlay()
        return
      }
    })

    // Clear at-min on any click outside the edge handle
    document.addEventListener('click', () => {
      bar.removeAttribute('data-at-min')
    })

    // Play icon + Playhead — single timeupdate listener
    const playBtn = el.querySelector('[data-play-btn]') as HTMLElement
    const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
    const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    if (playBtn) playBtn.innerHTML = playIcon

    const elapsedToHoldRatio = (elapsed: number): number => {
      const frames = props.frames
      const total = frames.reduce((s, f) => s + holdOf(f), 0)
      if (total <= 0) return 0
      let rem = elapsed
      let accHold = 0
      for (let k = 0; k < frames.length; k++) {
        const fHold = holdOf(frames[k])
        if (rem <= fHold) { accHold += rem; break }
        rem -= fHold
        accHold += fHold
        if (k < frames.length - 1) {
          if (rem <= TRANSITION_MS) { break }
          rem -= TRANSITION_MS
        }
      }
      return (accHold / total) * 100
    }

    let isDraggingPlayhead = false
    const onTimeUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (playBtn) playBtn.innerHTML = d.playing ? pauseIcon : playIcon
      if (playhead && !isDraggingPlayhead) {
        playhead.style.left = `${elapsedToHoldRatio(d.elapsed)}%`
      }
    }
    const prev = (el as any).__komaTimeUpdate as typeof onTimeUpdate | undefined
    if (prev) window.removeEventListener('koma:timeupdate', prev)
    ;(el as any).__komaTimeUpdate = onTimeUpdate
    window.addEventListener('koma:timeupdate', onTimeUpdate)

    // Playhead drag
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
            props.onSeek(Math.round(ratio * props.totalMs))
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

    // Total label
    createEffect(() => {
      if (totalLabel) {
        const totalHoldMs = props.frames.reduce((sum, f) => sum + holdOf(f), 0)
        const transitionsMs = Math.max(0, props.frames.length - 1) * TRANSITION_MS
        const total = totalHoldMs + transitionsMs
        totalLabel.textContent = Number.isFinite(total) ? formatDuration(total) : '—'
      }
    })

    // Rebuild segments when frames change
    let prevFrameIds = ''
    createEffect(() => {
      const frames = props.frames
      const ids = frames.map(f => f.id).join(',')
      if (ids === prevFrameIds) return
      prevFrameIds = ids

      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)

      bar.querySelectorAll('[data-seg]').forEach(s => s.remove())
      bar.querySelectorAll('[data-seg-handle]').forEach(s => s.remove())

      frames.forEach((frame, i) => {
        if (i > 0) {
          const handle = document.createElement('div')
          handle.setAttribute('data-seg-handle', String(i - 1))
          handle.className = 'koma-timeline-handle-bar'
          bar.insertBefore(handle, playhead)
        }
        const seg = document.createElement('div')
        seg.setAttribute('data-seg', frame.id)
        seg.className = 'koma-timeline-segment'
        const pct = totalHold > 0 ? (holdOf(frame) / totalHold) * 100 : 0
        seg.style.flexBasis = `${pct}%`
        seg.style.flexGrow = '0'
        seg.style.flexShrink = '0'
        const label = document.createElement('span')
        label.className = 'koma-timeline-label'
        label.textContent = String(i + 1)
        seg.appendChild(label)
        bar.insertBefore(seg, playhead)

        seg.addEventListener('click', (e) => {
          e.stopPropagation()
          props.onSelect(frame.id)
          if (totalHold > 0 && props.totalMs > 0) {
            const rect = bar.getBoundingClientRect()
            const barRatio = Math.max(0, Math.min(1, ((e as MouseEvent).clientX - rect.left) / rect.width))
            const holdMs = barRatio * totalHold
            let elapsed = 0
            let accHold = 0
            for (let k = 0; k < frames.length; k++) {
              const fHold = holdOf(frames[k])
              if (accHold + fHold >= holdMs) {
                elapsed += holdMs - accHold
                break
              }
              accHold += fHold
              elapsed += fHold
              if (k < frames.length - 1) elapsed += TRANSITION_MS
            }
            props.onSeek(Math.round(elapsed))
          }
        })
      })
    })

    // Update segment sizes when hold values change
    createEffect(() => {
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      if (totalHold <= 0) return
      frames.forEach((frame) => {
        const seg = bar.querySelector(`[data-seg="${frame.id}"]`) as HTMLElement
        if (seg) {
          const pct = (holdOf(frame) / totalHold) * 100
          seg.style.flexBasis = `${pct}%`
        }
      })
    })

    // Segment handle drag — delegate from bar, capture on handle
    bar.addEventListener('pointerdown', (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-seg-handle]') as HTMLElement
      if (!handle) return
      e.preventDefault()
      e.stopPropagation()
      handle.setPointerCapture(e.pointerId)
      handle.setAttribute('data-state', 'drag')

      const idx = Number(handle.getAttribute('data-seg-handle'))
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
      const barRect = bar.getBoundingClientRect()

      const onMove = (ev: PointerEvent) => {
        const ratio = Math.max(0, Math.min(1, (ev.clientX - barRect.left) / barRect.width))
        const cursorMs = ratio * totalHold
        let acc = 0
        for (let k = 0; k < idx; k++) acc += holdOf(frames[k])
        const combined = holdOf(frames[idx]) + holdOf(frames[idx + 1])
        let newThis = Math.round(cursorMs - acc)
        newThis = Math.max(50, Math.min(combined - 50, newThis))
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

    // Right-edge drag
    const edgeHandle = bar.querySelector('[data-timeline-edge]') as HTMLElement
    if (edgeHandle) {
      edgeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        edgeHandle.setPointerCapture(e.pointerId)
        edgeHandle.setAttribute('data-state', 'drag')

        const frames = props.frames
        const startHolds = frames.map(f => holdOf(f))
        const barLeft = bar.getBoundingClientRect().left
        const startWidth = bar.getBoundingClientRect().width
        const wrapperWidth = el.getBoundingClientRect().width

        const minHold = 50

        const onMove = (ev: PointerEvent) => {
          const newWidth = Math.max(60, ev.clientX - barLeft)
          const scale = newWidth / startWidth
          const holds = frames.map((f, i) => ({
            id: f.id,
            hold: Math.max(minHold, Math.round(startHolds[i] * scale)),
          }))

          const wouldShrink = scale < 1
          const allAtMin = holds.every(h => h.hold <= minHold)

          if (wouldShrink && allAtMin) {
            bar.setAttribute('data-at-min', '')
            return
          }

          if (newWidth < wrapperWidth) {
            bar.style.maxWidth = `${(newWidth / wrapperWidth) * 100}%`
          } else {
            bar.style.maxWidth = ''
          }
          bar.removeAttribute('data-at-min')
          props.onLayout(holds)
        }

        const cleanup = () => {
          edgeHandle.removeEventListener('pointermove', onMove)
          edgeHandle.removeEventListener('pointerup', cleanup)
          edgeHandle.removeEventListener('pointercancel', cleanup)
          edgeHandle.setAttribute('data-state', 'idle')
          bar.removeAttribute('data-at-min')
        }

        edgeHandle.addEventListener('pointermove', onMove)
        edgeHandle.addEventListener('pointerup', cleanup)
        edgeHandle.addEventListener('pointercancel', cleanup)
      })
    }
  }

  return (
    <div className="koma-timeline-wrapper" ref={handleMount}>
      <button type="button" className="koma-timeline-play" data-play-btn />
      <div className="koma-timeline" data-timeline-bar>
        <div data-playhead className="koma-timeline-playhead" />
        <div data-timeline-edge data-state="idle" className="koma-timeline-edge" />
      </div>
      <span data-total className="koma-timeline-total" />
    </div>
  )
}
