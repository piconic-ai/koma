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

export type LineStyle = {
  opacity: number
  translateY: number // px
}

const ADD_TRANSLATE_PX = 8
const REMOVE_TRANSLATE_PX = -8

export function styleForLine(role: LineRole, progress: number): LineStyle {
  switch (role.type) {
    case 'keep':
      return { opacity: 1, translateY: 0 }
    case 'add':
      return {
        opacity: progress,
        translateY: (1 - progress) * ADD_TRANSLATE_PX,
      }
    case 'remove':
      return {
        opacity: 1 - progress,
        translateY: progress * REMOVE_TRANSLATE_PX,
      }
  }
}
