// Per-frame interpolation helpers consumed by the Player.
//
// Given a `Timeline` and an elapsed time, `getStageState` decides
// whether the renderer should draw a static frame or an in-flight
// transition, and bundles the data the component needs.

import { locateInTimeline } from '../model/timeline'
import type { Frame, LineRole, Timeline } from '../model/types'

export type StageState =
  | { kind: 'hold'; frame: Frame }
  | { kind: 'transition'; lines: LineRole[]; progress: number }

export function getStageState(timeline: Timeline, elapsedMs: number): StageState {
  if (timeline.segments.length === 0) {
    // Shouldn't happen — empty Spec is normalized upstream — but
    // returning a defensive shape keeps the caller simple.
    return { kind: 'hold', frame: { id: '', code: '' } }
  }
  const pos = locateInTimeline(timeline, elapsedMs)
  const segment = timeline.segments[pos.segmentIndex]
  if (segment.type === 'hold') {
    return { kind: 'hold', frame: segment.frame }
  }
  return {
    kind: 'transition',
    lines: segment.transition.lines,
    progress: pos.segmentProgress,
  }
}

// Ultra-fast typing: characters appear/disappear one by one.
// Remove lines erase in the first 30% of the transition,
// add lines type in the remaining 70%.
export type TypingState = {
  visibleChars: number // -1 = show all
  showCursor: boolean
  visible: boolean
}

const ERASE_PHASE = 0.3

export function typingForLine(role: LineRole, progress: number): TypingState {
  if (role.type === 'keep') {
    return { visibleChars: -1, showCursor: false, visible: true }
  }
  if (role.type === 'remove') {
    if (progress >= ERASE_PHASE) {
      return { visibleChars: 0, showCursor: false, visible: false }
    }
    const p = progress / ERASE_PHASE
    const total = role.line.length
    return {
      visibleChars: Math.max(0, Math.ceil(total * (1 - p))),
      showCursor: total > 0,
      visible: true,
    }
  }
  // add
  if (progress < ERASE_PHASE) {
    return { visibleChars: 0, showCursor: false, visible: false }
  }
  const p = (progress - ERASE_PHASE) / (1 - ERASE_PHASE)
  const total = role.line.length
  return {
    visibleChars: Math.floor(total * p),
    showCursor: total > 0 && p < 1,
    visible: true,
  }
}
