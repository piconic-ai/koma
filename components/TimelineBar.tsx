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

    // Play icon + Playhead — single timeupdate listener
    const playBtn = el.querySelector('[data-play-btn]') as HTMLElement
    const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
    const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    if (playBtn) playBtn.innerHTML = playIcon

    let isDraggingPlayhead = false
    const onTimeUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (playBtn) playBtn.innerHTML = d.playing ? pauseIcon : playIcon
      if (playhead && !isDraggingPlayhead) {
        const pct = d.total > 0 ? (d.elapsed / d.total) * 100 : 0
        playhead.style.left = `${pct}%`
      }
    }
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
          props.onSeek(Math.round(ratio * (props.totalMs || 8800)))
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
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)

      // Rebuild segment DOM
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
        const pct = (holdOf(frame) / totalHold) * 100
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
          if (props.totalMs > 0) {
            const rect = bar.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, ((e as MouseEvent).clientX - rect.left) / rect.width))
            props.onSeek(Math.round(ratio * props.totalMs))
          }
        })
      })

      prevFrameIds = ids
    })

    // Update segment sizes when hold values change
    createEffect(() => {
      const frames = props.frames
      const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
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
        const startWidth = bar.getBoundingClientRect().width
        const barLeft = bar.getBoundingClientRect().left

        const onMove = (ev: PointerEvent) => {
          const newWidth = Math.max(60, ev.clientX - barLeft)
          const scale = newWidth / startWidth
          const holds = frames.map((f, i) => ({
            id: f.id,
            hold: Math.max(50, Math.round(startHolds[i] * scale)),
          }))
          bar.style.maxWidth = `${(newWidth / el.getBoundingClientRect().width) * 100}%`
          props.onLayout(holds)
        }

        const cleanup = () => {
          edgeHandle.removeEventListener('pointermove', onMove)
          edgeHandle.removeEventListener('pointerup', cleanup)
          edgeHandle.removeEventListener('pointercancel', cleanup)
          edgeHandle.setAttribute('data-state', 'idle')
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
