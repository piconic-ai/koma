export const HOLD_PER_LINE_MS = 600
export const MIN_HOLD_MS = 2500
export const TRANSITION_MS = 400
export const MIN_HOLD = 50

export function autoHold(code: string): number {
  const lines = code.split('\n').length
  return Math.max(MIN_HOLD_MS, lines * HOLD_PER_LINE_MS)
}

export function holdOf(frame: { code: string; hold?: number }): number {
  return frame.hold ?? autoHold(frame.code)
}

export function formatDuration(ms: number): string {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

export type FrameInput = { id: string; code: string; hold?: number }

export function computeSegmentPcts(frames: FrameInput[]): number[] {
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
  if (totalHold <= 0) return frames.map(() => 0)
  return frames.map(f => (holdOf(f) / totalHold) * 100)
}

export function computeTotalMs(frames: FrameInput[]): number {
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
  const transitions = Math.max(0, frames.length - 1) * TRANSITION_MS
  return totalHold + transitions
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

export function elapsedToHoldRatio(
  elapsed: number,
  frames: FrameInput[],
): number {
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
      if (rem <= TRANSITION_MS) break
      rem -= TRANSITION_MS
    }
  }
  return (accHold / total) * 100
}

export function holdRatioToElapsed(
  barRatio: number,
  frames: FrameInput[],
): number {
  const totalHold = frames.reduce((s, f) => s + holdOf(f), 0)
  if (totalHold <= 0) return 0
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
  return elapsed
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
    return { holds, maxWidthPct: null, atMin: true, blocked: false }
  }

  const maxWidthPct = newWidth < wrapperWidth
    ? (newWidth / wrapperWidth) * 100
    : null

  return { holds, maxWidthPct, atMin: false, blocked: false }
}
