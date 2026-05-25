import { describe, expect, test } from 'vitest'

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

function computeSegmentPcts(frames: Array<{ code: string; hold?: number }>) {
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
  if (totalHold <= 0) return frames.map(() => 0)
  return frames.map(f => (holdOf(f) / totalHold) * 100)
}

function computeTotalMs(frames: Array<{ code: string; hold?: number }>) {
  const totalHold = frames.reduce((sum, f) => sum + holdOf(f), 0)
  const transitions = Math.max(0, frames.length - 1) * TRANSITION_MS
  return totalHold + transitions
}

function redistributeHolds(
  frames: Array<{ id: string; code: string; hold?: number }>,
  idx: number,
  newHoldThis: number,
) {
  const thisHold = holdOf(frames[idx])
  const nextHold = holdOf(frames[idx + 1])
  const combined = thisHold + nextHold
  const minHold = 50
  const clamped = Math.max(minHold, Math.min(combined - minHold, newHoldThis))
  return [
    { id: frames[idx].id, hold: clamped },
    { id: frames[idx + 1].id, hold: combined - clamped },
  ]
}

function scaleAllHolds(
  frames: Array<{ id: string; code: string; hold?: number }>,
  scale: number,
) {
  return frames.map(f => ({
    id: f.id,
    hold: Math.max(50, Math.round(holdOf(f) * scale)),
  }))
}

describe('holdOf', () => {
  test('uses explicit hold when set', () => {
    expect(holdOf({ code: 'a', hold: 1000 })).toBe(1000)
  })

  test('auto-calculates from line count', () => {
    expect(holdOf({ code: 'a' })).toBe(MIN_HOLD_MS)
    expect(holdOf({ code: 'a\nb\nc\nd\ne' })).toBe(5 * HOLD_PER_LINE_MS)
  })

  test('auto-hold respects minimum', () => {
    expect(holdOf({ code: 'a' })).toBeGreaterThanOrEqual(MIN_HOLD_MS)
  })
})

describe('computeSegmentPcts', () => {
  test('equal holds produce equal percentages', () => {
    const frames = [
      { code: 'a', hold: 1000 },
      { code: 'b', hold: 1000 },
    ]
    const pcts = computeSegmentPcts(frames)
    expect(pcts).toEqual([50, 50])
  })

  test('proportional to hold values', () => {
    const frames = [
      { code: 'a', hold: 1000 },
      { code: 'b', hold: 3000 },
    ]
    const pcts = computeSegmentPcts(frames)
    expect(pcts[0]).toBeCloseTo(25, 5)
    expect(pcts[1]).toBeCloseTo(75, 5)
  })

  test('returns zeros for empty frames', () => {
    expect(computeSegmentPcts([])).toEqual([])
  })

  test('handles zero-hold frames without NaN', () => {
    const frames = [{ code: 'a', hold: 0 }, { code: 'b', hold: 0 }]
    const pcts = computeSegmentPcts(frames)
    expect(pcts.every(p => Number.isFinite(p))).toBe(true)
    expect(pcts).toEqual([0, 0])
  })
})

describe('computeTotalMs', () => {
  test('includes transition time between frames', () => {
    const frames = [
      { code: 'a', hold: 1000 },
      { code: 'b', hold: 1000 },
      { code: 'c', hold: 1000 },
    ]
    expect(computeTotalMs(frames)).toBe(3000 + 2 * TRANSITION_MS)
  })

  test('single frame has no transitions', () => {
    expect(computeTotalMs([{ code: 'a', hold: 1000 }])).toBe(1000)
  })

  test('empty frames returns 0', () => {
    expect(computeTotalMs([])).toBe(0)
  })
})

describe('formatDuration', () => {
  test('formats sub-10s with one decimal', () => {
    expect(formatDuration(8800)).toBe('8.8s')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(0)).toBe('0.0s')
  })

  test('formats 10s+ as integer', () => {
    expect(formatDuration(10000)).toBe('10s')
    expect(formatDuration(15500)).toBe('16s')
  })
})

describe('redistributeHolds', () => {
  const frames = [
    { id: 'a', code: 'x', hold: 2000 },
    { id: 'b', code: 'y', hold: 2000 },
    { id: 'c', code: 'z', hold: 2000 },
  ]

  test('redistributes hold between adjacent frames', () => {
    const result = redistributeHolds(frames, 0, 3000)
    expect(result[0].hold).toBe(3000)
    expect(result[1].hold).toBe(1000)
    expect(result[0].hold + result[1].hold).toBe(4000)
  })

  test('preserves combined total', () => {
    const result = redistributeHolds(frames, 1, 500)
    expect(result[0].hold + result[1].hold).toBe(4000)
  })

  test('clamps to minimum hold of 50ms', () => {
    const result = redistributeHolds(frames, 0, 0)
    expect(result[0].hold).toBe(50)
    expect(result[1].hold).toBe(3950)
  })

  test('clamps to maximum (combined - 50ms)', () => {
    const result = redistributeHolds(frames, 0, 99999)
    expect(result[0].hold).toBe(3950)
    expect(result[1].hold).toBe(50)
  })
})

describe('scaleAllHolds', () => {
  const frames = [
    { id: 'a', code: 'x', hold: 2000 },
    { id: 'b', code: 'y', hold: 3000 },
  ]

  test('scales proportionally', () => {
    const result = scaleAllHolds(frames, 0.5)
    expect(result[0].hold).toBe(1000)
    expect(result[1].hold).toBe(1500)
  })

  test('clamps to minimum 50ms', () => {
    const result = scaleAllHolds(frames, 0.01)
    expect(result[0].hold).toBe(50)
    expect(result[1].hold).toBe(50)
  })

  test('scale > 1 extends', () => {
    const result = scaleAllHolds(frames, 2)
    expect(result[0].hold).toBe(4000)
    expect(result[1].hold).toBe(6000)
  })

  test('preserves frame IDs', () => {
    const result = scaleAllHolds(frames, 1)
    expect(result.map(r => r.id)).toEqual(['a', 'b'])
  })
})
