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
}

export function TimelineBar(props: TimelineBarProps) {
  const frames = props.frames
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)

  const onLayout = (sizes: number[]) => {
    const holds = frames.map((f, i) => ({
      id: f.id,
      hold: Math.max(200, Math.round((sizes[i] / 100) * totalHold)),
    }))
    props.onLayout(holds)
  }

  const totalRef = (el: HTMLElement) => {
    createEffect(() => {
      const totalHoldMs = props.frames.reduce((sum, f) => sum + holdOf(f), 0)
      const transitionsMs = Math.max(0, props.frames.length - 1) * TRANSITION_MS
      el.textContent = formatDuration(totalHoldMs + transitionsMs)
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
        <span
          className="koma-timeline-label"
          onClick={() => props.onSelect(frame.id)}
        >
          {i + 1}
        </span>
      </ResizablePanel>
    )
    if (i === 0) return [panel]
    return [<ResizableHandle key={`h-${frame.id}`} />, panel]
  })

  return (
    <div className="koma-timeline-wrapper">
      <ResizablePanelGroup
        direction="horizontal"
        className="koma-timeline"
        onLayout={onLayout}
      >
        {children}
      </ResizablePanelGroup>
      <span className="koma-timeline-total" ref={totalRef} />
    </div>
  )
}
