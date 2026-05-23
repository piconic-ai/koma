// Build a playable timeline from a `Spec`.
//
// The timeline is an alternating sequence of `hold` and `transition`
// segments. Holds reuse a frame's static representation; transitions
// carry the per-line diff (see `computeLineRoles`). Auto-derived hold
// durations grow with the frame's line count, with a floor of
// `minHoldMs` so very short frames still stay on screen long enough
// to read.

import { computeLineRoles } from './diff'
import { DEFAULTS, type Defaults, type Spec, type Timeline } from './types'

export function computeAutoHold(code: string, defaults: Defaults): number {
  const lines = code.split('\n').length
  return Math.max(defaults.minHoldMs, lines * defaults.holdPerLineMs)
}

export function buildTimeline(
  spec: Spec,
  defaults: Defaults = DEFAULTS,
): Timeline {
  const segments: Timeline['segments'] = []

  for (let i = 0; i < spec.frames.length; i++) {
    const frame = spec.frames[i]

    if (i > 0) {
      const prev = spec.frames[i - 1]
      const duration = frame.transition?.duration ?? defaults.transitionMs
      segments.push({
        type: 'transition',
        durationMs: duration,
        transition: {
          fromFrameId: prev.id,
          toFrameId: frame.id,
          lines: computeLineRoles(prev, frame),
          durationMs: duration,
        },
      })
    }

    const hold = frame.hold ?? computeAutoHold(frame.code, defaults)
    segments.push({ type: 'hold', frame, durationMs: hold })
  }

  // The video doesn't loop, but SNS players (e.g. X) do — pad the final
  // hold so the still doesn't blow past before the viewer reads it.
  const lastHold = [...segments].reverse().find(s => s.type === 'hold')
  if (
    lastHold &&
    lastHold.type === 'hold' &&
    lastHold.durationMs < defaults.finalFrameMinHoldMs
  ) {
    lastHold.durationMs = defaults.finalFrameMinHoldMs
  }

  const totalDurationMs = segments.reduce((sum, s) => sum + s.durationMs, 0)
  return { segments, totalDurationMs }
}

export type TimelinePosition = {
  segmentIndex: number
  segmentProgress: number // 0..1 across the active segment
  elapsedMs: number
}

export function locateInTimeline(
  timeline: Timeline,
  elapsedMs: number,
): TimelinePosition {
  const clamped = Math.max(0, Math.min(elapsedMs, timeline.totalDurationMs))
  let acc = 0
  for (let i = 0; i < timeline.segments.length; i++) {
    const seg = timeline.segments[i]
    // Strict `<` so a moment that lands exactly on a boundary belongs
    // to the *next* segment — keeps "end of hold" and "start of
    // transition" from rendering the same intermediate state.
    if (clamped < acc + seg.durationMs) {
      const local = clamped - acc
      const progress = seg.durationMs === 0 ? 1 : local / seg.durationMs
      return { segmentIndex: i, segmentProgress: progress, elapsedMs: clamped }
    }
    acc += seg.durationMs
  }
  // Past the end — pin to the final segment.
  return {
    segmentIndex: timeline.segments.length - 1,
    segmentProgress: 1,
    elapsedMs: timeline.totalDurationMs,
  }
}

export function collapseTransitions(timeline: Timeline): Timeline {
  // For prefers-reduced-motion: keep the segment shapes (so the
  // segmentIndex math stays valid) but zero out transition durations.
  const segments = timeline.segments.map(s =>
    s.type === 'transition' ? { ...s, durationMs: 0 } : s,
  )
  const totalDurationMs = segments.reduce((sum, s) => sum + s.durationMs, 0)
  return { segments, totalDurationMs }
}
