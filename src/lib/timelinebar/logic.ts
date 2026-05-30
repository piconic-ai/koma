import { DEFAULTS } from '../../model/types'

export const HOLD_PER_LINE_MS = DEFAULTS.holdPerLineMs
export const MIN_HOLD_MS = DEFAULTS.minHoldMs
export const TRANSITION_MS = DEFAULTS.transitionMs
export const MIN_TRANSITION_MS = DEFAULTS.minTransitionMs
export const MAX_TRANSITION_MS = DEFAULTS.maxTransitionMs
export const FINAL_FRAME_MIN_HOLD_MS = DEFAULTS.finalFrameMinHoldMs
export const MIN_HOLD = 50

export function autoHold(code: string): number {
  const lines = code.split('\n').length
  return Math.max(MIN_HOLD_MS, lines * HOLD_PER_LINE_MS)
}

export function holdOf(frame: { code: string; hold?: number }): number {
  return frame.hold ?? autoHold(frame.code)
}

export function isAtMinHold(frame: { code: string; hold?: number }): boolean {
  return holdOf(frame) <= MIN_HOLD
}

export function formatDuration(ms: number): string {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

export type FrameInput = {
  id: string
  code: string
  hold?: number
  /** Override for the transition *into* this frame (from the previous one). */
  transition?: { duration?: number }
}

// The transition *into* frame `toIdx` (i.e. between frame `toIdx-1` and
// `toIdx`). Stored on the destination frame, mirroring `buildTimeline`.
// Frame 0 has no incoming transition, so it returns 0.
export function transitionOf(frames: FrameInput[], toIdx: number): number {
  if (toIdx <= 0 || toIdx >= frames.length) return 0
  return frames[toIdx].transition?.duration ?? TRANSITION_MS
}

export function totalTransitionMs(frames: FrameInput[]): number {
  let sum = 0
  for (let i = 1; i < frames.length; i++) sum += transitionOf(frames, i)
  return sum
}

export function effectiveHolds(frames: FrameInput[]): number[] {
  if (frames.length === 0) return []
  const holds = frames.map(f => holdOf(f))
  const lastIdx = holds.length - 1
  if (holds[lastIdx] < FINAL_FRAME_MIN_HOLD_MS) {
    holds[lastIdx] = FINAL_FRAME_MIN_HOLD_MS
  }
  return holds
}

export function computeSegmentPcts(frames: FrameInput[]): number[] {
  const holds = effectiveHolds(frames)
  const totalHold = holds.reduce((sum, h) => sum + h, 0)
  if (totalHold <= 0) return frames.map(() => 0)
  return holds.map(h => (h / totalHold) * 100)
}

export function computeTotalMs(frames: FrameInput[]): number {
  const holds = effectiveHolds(frames)
  const totalHold = holds.reduce((sum, h) => sum + h, 0)
  return totalHold + totalTransitionMs(frames)
}

// The bar is an alternating sequence of hold / transition segments:
// [hold0, trans1, hold1, trans2, hold2, ...]. Each segment's `pct` is
// its share of the *grand total* (holds + transitions), so they sum to
// 100% — transitions now occupy real width instead of being collapsed.
export type BarSegment =
  | { kind: 'hold'; frameIndex: number; pct: number; ms: number }
  | { kind: 'transition'; toFrameIndex: number; pct: number; ms: number }

export function computeBarSegments(frames: FrameInput[]): BarSegment[] {
  if (frames.length === 0) return []
  const holds = effectiveHolds(frames)
  const total = computeTotalMs(frames)
  const pct = (ms: number) => (total > 0 ? (ms / total) * 100 : 0)
  const segments: BarSegment[] = []
  for (let i = 0; i < frames.length; i++) {
    if (i > 0) {
      const tms = transitionOf(frames, i)
      segments.push({ kind: 'transition', toFrameIndex: i, pct: pct(tms), ms: tms })
    }
    segments.push({ kind: 'hold', frameIndex: i, pct: pct(holds[i]), ms: holds[i] })
  }
  return segments
}

// Elapsed time (ms) at which frame `frameIndex` starts playing — the
// running sum of every prior hold plus the transitions between them.
export function frameStartMs(frames: FrameInput[], frameIndex: number): number {
  const holds = effectiveHolds(frames)
  let ms = 0
  for (let k = 0; k < frameIndex && k < holds.length; k++) {
    ms += holds[k]
    ms += transitionOf(frames, k + 1)
  }
  return ms
}

export function redistributeHolds(
  frames: FrameInput[],
  idx: number,
  newHoldThis: number,
): Array<{ id: string; hold: number }> {
  const thisHold = holdOf(frames[idx])
  const nextHold = holdOf(frames[idx + 1])
  const combined = thisHold + nextHold
  const clamped = Math.max(MIN_HOLD, Math.min(combined - MIN_HOLD, newHoldThis))
  return [
    { id: frames[idx].id, hold: clamped },
    { id: frames[idx + 1].id, hold: combined - clamped },
  ]
}

export function scaleAllHolds(
  frames: FrameInput[],
  scale: number,
): Array<{ id: string; hold: number }> {
  return frames.map(f => ({
    id: f.id,
    hold: Math.max(MIN_HOLD, Math.round(holdOf(f) * scale)),
  }))
}

export const MIN_EXTEND_MS_PER_PX = 5

export function computeExtensionHolds(
  startHolds: number[],
  frameIds: string[],
  pixelsPast: number,
  startWidth: number,
): Array<{ id: string; hold: number }> {
  const totalStartHold = startHolds.reduce((s, h) => s + h, 0)
  const normalMsPerPx = startWidth > 0 ? totalStartHold / startWidth : 0
  const msPerPx = Math.max(MIN_EXTEND_MS_PER_PX, normalMsPerPx)
  const additionalMs = pixelsPast * msPerPx
  const scale = totalStartHold > 0
    ? (totalStartHold + additionalMs) / totalStartHold
    : 1
  return frameIds.map((id, i) => ({
    id,
    hold: Math.max(MIN_HOLD, Math.round(startHolds[i] * scale)),
  }))
}

export function computeEdgeDrag(
  startHolds: number[],
  frameIds: string[],
  scale: number,
): { holds: Array<{ id: string; hold: number }>; allAtMin: boolean; startAllAtMin: boolean } {
  const startAllAtMin = startHolds.every(h => h <= MIN_HOLD)
  const holds = frameIds.map((id, i) => ({
    id,
    hold: Math.max(MIN_HOLD, Math.round(startHolds[i] * scale)),
  }))
  const allAtMin = holds.every(h => h.hold <= MIN_HOLD)
  return { holds, allAtMin, startAllAtMin }
}

// Transitions are now visible, fixed-width bar segments, so the playhead
// advances linearly through the *whole* timeline (holds + transitions)
// rather than freezing during a transition. Bar position is simply the
// elapsed share of the grand total.
export function elapsedToPlayheadPct(
  elapsed: number,
  frames: FrameInput[],
): number {
  const total = computeTotalMs(frames)
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, elapsed / total)) * 100
}

export function barRatioToElapsed(
  barRatio: number,
  frames: FrameInput[],
): number {
  const total = computeTotalMs(frames)
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, barRatio)) * total
}

export function hoverTimeLabel(ratio: number, frames: FrameInput[]): string {
  const elapsed = barRatioToElapsed(ratio, frames)
  return formatDuration(Math.round(elapsed))
}

export function computeBarWidth(params: {
  newWidth: number
  startWidth: number
  wrapperWidth: number
  startHolds: number[]
  frameIds: string[]
}): {
  holds: Array<{ id: string; hold: number }>
  maxWidthPct: number | null
  atMin: boolean
  blocked: boolean
} {
  const { newWidth, startWidth, wrapperWidth, startHolds, frameIds } = params
  const scale = newWidth / startWidth
  const { holds, allAtMin, startAllAtMin } = computeEdgeDrag(startHolds, frameIds, scale)

  if (startAllAtMin && scale < 1) {
    return { holds: [], maxWidthPct: null, atMin: true, blocked: true }
  }

  if (allAtMin) {
    const minTotal = frameIds.length * MIN_HOLD
    const startTotal = startHolds.reduce((s, h) => s + h, 0)
    const minWidth = startTotal > 0 ? (minTotal / startTotal) * startWidth : startWidth
    const maxWidthPct = minWidth < wrapperWidth
      ? (minWidth / wrapperWidth) * 100
      : null
    return { holds, maxWidthPct, atMin: true, blocked: false }
  }

  const maxWidthPct = newWidth < wrapperWidth
    ? (newWidth / wrapperWidth) * 100
    : null

  return { holds, maxWidthPct, atMin: false, blocked: false }
}

export const BASE_DURATION_MS = 2900

export function computeBarWidthPct(frames: FrameInput[]): number {
  const totalMs = computeTotalMs(frames)
  if (totalMs <= 0) return 0
  return (totalMs / BASE_DURATION_MS) * 100
}

export function clientXToRatio(clientX: number, rect: { left: number; width: number }): number {
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

export function computeSegmentDrag(
  ratio: number,
  idx: number,
  frames: FrameInput[],
): Array<{ id: string; hold: number }> {
  // The handle sits at frame `idx`'s right edge (left edge of the
  // transition into `idx+1`). `ratio` spans the whole bar, so the cursor
  // position must be measured against the grand total — including the
  // transitions that now occupy visible width before this handle.
  const cursorMs = ratio * computeTotalMs(frames)
  let acc = 0
  for (let k = 0; k < idx; k++) {
    acc += holdOf(frames[k])
    acc += transitionOf(frames, k + 1)
  }
  const combined = holdOf(frames[idx]) + holdOf(frames[idx + 1])
  let newThis = Math.round(cursorMs - acc)
  newThis = Math.max(MIN_HOLD, Math.min(combined - MIN_HOLD, newThis))
  return [
    { id: frames[idx].id, hold: newThis },
    { id: frames[idx + 1].id, hold: combined - newThis },
  ]
}

// Resize a single transition by dragging its edge. `msPerPx` is captured
// at pointer-down (grand-total / bar pixel-width) so the mapping stays
// stable even though lengthening the transition grows the total. Holds
// are untouched — only the total duration changes.
export function computeTransitionDragPx(
  deltaPx: number,
  startDuration: number,
  msPerPx: number,
): number {
  const raw = startDuration + deltaPx * msPerPx
  return Math.max(MIN_TRANSITION_MS, Math.min(MAX_TRANSITION_MS, Math.round(raw)))
}
