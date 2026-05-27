import { describe, expect, test } from 'bun:test'
import {
  autoHold,
  holdOf,
  isAtMinHold,
  formatDuration,
  effectiveHolds,
  computeSegmentPcts,
  computeTotalMs,
  redistributeHolds,
  scaleAllHolds,
  computeEdgeDrag,
  elapsedToPlayheadPct,
  elapsedToHoldRatio,
  holdRatioToElapsed,
  hoverTimeLabel,
  computeBarWidth,
  computeBarWidthPct,
  computeExtensionHolds,
  computeSegmentDrag,
  MIN_HOLD,
  MIN_HOLD_MS,
  MIN_EXTEND_MS_PER_PX,
  HOLD_PER_LINE_MS,
  TRANSITION_MS,
  FINAL_FRAME_MIN_HOLD_MS,
  BASE_DURATION_MS,
  type FrameInput,
} from './logic'

// ── Helpers ──────────────────────────────────────────────

const f = (code: string, hold?: number): FrameInput => ({ id: `f${Math.random().toString(36).slice(2, 6)}`, code, hold })
const f3 = (h1: number, h2: number, h3: number): FrameInput[] => [
  { id: 'a', code: 'x', hold: h1 },
  { id: 'b', code: 'y', hold: h2 },
  { id: 'c', code: 'z', hold: h3 },
]
const FH = FINAL_FRAME_MIN_HOLD_MS

// ── holdOf ───────────────────────────────────────────────

describe('holdOf', () => {
  test('uses explicit hold', () => {
    expect(holdOf({ code: 'a', hold: 1000 })).toBe(1000)
  })

  test('auto from 1 line', () => {
    expect(holdOf({ code: 'a' })).toBe(MIN_HOLD_MS)
  })

  test('auto from 5 lines', () => {
    expect(holdOf({ code: 'a\nb\nc\nd\ne' })).toBe(5 * HOLD_PER_LINE_MS)
  })

  test('hold=0 is explicit zero', () => {
    expect(holdOf({ code: 'a', hold: 0 })).toBe(0)
  })
})

// ── computeSegmentPcts ───────────────────────────────────

describe('computeSegmentPcts', () => {
  test('equal holds → equal pcts', () => {
    // Use holds >= FINAL_FRAME_MIN_HOLD_MS so padding doesn't affect the last frame
    const pcts = computeSegmentPcts(f3(3000, 3000, 3000))
    pcts.forEach(p => expect(p).toBeCloseTo(100 / 3, 5))
  })

  test('pcts sum to 100', () => {
    const pcts = computeSegmentPcts(f3(500, 1500, 3000))
    expect(pcts.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })

  test('empty → empty', () => {
    expect(computeSegmentPcts([])).toEqual([])
  })

  test('all zero holds → last frame padded to FH', () => {
    // f3(0,0,0) → effectiveHolds = [0, 0, 3000] → totalHold = 3000
    expect(computeSegmentPcts(f3(0, 0, 0))).toEqual([0, 0, 100])
  })

  test('never NaN', () => {
    computeSegmentPcts(f3(0, 0, 0)).forEach(p => expect(Number.isFinite(p)).toBe(true))
  })
})

// ── effectiveHolds ──────────────────────────────────────

describe('effectiveHolds', () => {
  test('pads last frame when below FINAL_FRAME_MIN_HOLD_MS', () => {
    const frames = f3(2000, 2000, 500)
    const holds = effectiveHolds(frames)
    expect(holds).toEqual([2000, 2000, FH])
  })

  test('does not pad last frame when at or above FINAL_FRAME_MIN_HOLD_MS', () => {
    const frames = f3(2000, 2000, 3000)
    const holds = effectiveHolds(frames)
    expect(holds).toEqual([2000, 2000, 3000])
  })

  test('does not pad last frame when above FINAL_FRAME_MIN_HOLD_MS', () => {
    const frames = f3(2000, 2000, 5000)
    const holds = effectiveHolds(frames)
    expect(holds).toEqual([2000, 2000, 5000])
  })

  test('single frame padded', () => {
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: 500 }]
    expect(effectiveHolds(frames)).toEqual([FH])
  })

  test('empty frames → empty array', () => {
    expect(effectiveHolds([])).toEqual([])
  })

  test('all zeros → last frame padded to FH', () => {
    expect(effectiveHolds(f3(0, 0, 0))).toEqual([0, 0, FH])
  })
})

// ── computeTotalMs with final-frame padding ─────────────

describe('computeTotalMs with final-frame padding', () => {
  test('single frame with hold < FH → total = FH', () => {
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: 200 }]
    expect(computeTotalMs(frames)).toBe(FH)
  })

  test('single frame with hold = FH → total = FH', () => {
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: FH }]
    expect(computeTotalMs(frames)).toBe(FH)
  })

  test('single frame with hold > FH → total = hold', () => {
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: 5000 }]
    expect(computeTotalMs(frames)).toBe(5000)
  })

  test('3 frames where last is padded', () => {
    const frames = f3(2000, 2000, 500)
    expect(computeTotalMs(frames)).toBe(2000 + 2000 + FH + 2 * TRANSITION_MS)
  })
})

// ── computeTotalMs ───────────────────────────────────────

describe('computeTotalMs', () => {
  test.each([
    { frames: f3(2500, 2500, 3000), expected: 8000 + 2 * TRANSITION_MS },
    { frames: [f('a', 200)], expected: FH }, // single frame: hold 200 padded to FH
    { frames: [], expected: 0 },
    { frames: f3(50, 50, 50), expected: 50 + 50 + FH + 2 * TRANSITION_MS }, // last frame padded
  ])('$expected ms for given frames', ({ frames, expected }) => {
    expect(computeTotalMs(frames)).toBe(expected)
  })
})

// ── formatDuration ───────────────────────────────────────

describe('formatDuration', () => {
  test.each([
    [0, '0.0s'],
    [500, '0.5s'],
    [8800, '8.8s'],
    [9999, '10.0s'],
    [10000, '10s'],
    [15500, '16s'],
    [950, '0.9s'],
  ])('%ims → %s', (ms, str) => {
    expect(formatDuration(ms)).toBe(str)
  })
})

// ── redistributeHolds ────────────────────────────────────

describe('redistributeHolds', () => {
  const frames = f3(2000, 2000, 2000)

  test('preserves combined total', () => {
    const r = redistributeHolds(frames, 0, 3000)
    expect(r[0].hold + r[1].hold).toBe(4000)
  })

  test('clamps to MIN_HOLD', () => {
    const r = redistributeHolds(frames, 0, 0)
    expect(r[0].hold).toBe(MIN_HOLD)
    expect(r[1].hold).toBe(4000 - MIN_HOLD)
  })

  test('clamps to combined - MIN_HOLD', () => {
    const r = redistributeHolds(frames, 0, 999999)
    expect(r[0].hold).toBe(4000 - MIN_HOLD)
    expect(r[1].hold).toBe(MIN_HOLD)
  })
})

// ── scaleAllHolds ────────────────────────────────────────

describe('scaleAllHolds', () => {
  const frames = f3(2000, 2000, 2000)

  test('scale=1 preserves', () => {
    const r = scaleAllHolds(frames, 1)
    expect(r.map(h => h.hold)).toEqual([2000, 2000, 2000])
  })

  test('scale=0.5', () => {
    const r = scaleAllHolds(frames, 0.5)
    expect(r.map(h => h.hold)).toEqual([1000, 1000, 1000])
  })

  test('clamps to MIN_HOLD', () => {
    const r = scaleAllHolds(frames, 0.001)
    r.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('preserves IDs', () => {
    const r = scaleAllHolds(frames, 1)
    expect(r.map(h => h.id)).toEqual(['a', 'b', 'c'])
  })
})

// ── computeEdgeDrag ──────────────────────────────────────

describe('computeEdgeDrag', () => {
  test('scale < 1 with high holds → not at min', () => {
    const r = computeEdgeDrag([2000, 2000, 2000], ['a', 'b', 'c'], 0.5)
    expect(r.allAtMin).toBe(false)
    expect(r.startAllAtMin).toBe(false)
    expect(r.holds.map(h => h.hold)).toEqual([1000, 1000, 1000])
  })

  test('scale very small → clamp to MIN_HOLD → allAtMin', () => {
    const r = computeEdgeDrag([2000, 2000, 2000], ['a', 'b', 'c'], 0.001)
    expect(r.allAtMin).toBe(true)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('already at min → startAllAtMin=true', () => {
    const r = computeEdgeDrag([50, 50, 50], ['a', 'b', 'c'], 0.5)
    expect(r.startAllAtMin).toBe(true)
    expect(r.allAtMin).toBe(true)
  })

  test('hold=51 at scale < 1 → shrinks to 50', () => {
    const r = computeEdgeDrag([51, 51, 51], ['a', 'b', 'c'], 0.9)
    expect(r.startAllAtMin).toBe(false)
    expect(r.allAtMin).toBe(true)
    expect(r.holds.map(h => h.hold)).toEqual([50, 50, 50])
  })

  test('scale > 1 → extends', () => {
    const r = computeEdgeDrag([1000, 1000, 1000], ['a', 'b', 'c'], 2)
    expect(r.holds.map(h => h.hold)).toEqual([2000, 2000, 2000])
    expect(r.allAtMin).toBe(false)
  })
})

// ── computeBarWidth ──────────────────────────────────────

describe('computeBarWidth', () => {
  const base = {
    wrapperWidth: 1000,
    startWidth: 1000,
    startHolds: [2000, 2000, 2000],
    frameIds: ['a', 'b', 'c'],
  }

  test('shrink → maxWidthPct set', () => {
    const r = computeBarWidth({ ...base, newWidth: 700 })
    expect(r.maxWidthPct).toBeCloseTo(70)
    expect(r.atMin).toBe(false)
    expect(r.blocked).toBe(false)
  })

  test('expand → maxWidthPct null', () => {
    const r = computeBarWidth({ ...base, newWidth: 1200 })
    expect(r.maxWidthPct).toBeNull()
    expect(r.atMin).toBe(false)
  })

  test('shrink to min → atMin, maxWidthPct reflects min holds', () => {
    const r = computeBarWidth({ ...base, newWidth: 10 })
    expect(r.atMin).toBe(true)
    expect(r.maxWidthPct).not.toBeNull()
    expect(r.blocked).toBe(false)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('already at min + shrink → blocked', () => {
    const r = computeBarWidth({
      ...base,
      startHolds: [50, 50, 50],
      newWidth: 500,
    })
    expect(r.blocked).toBe(true)
    expect(r.atMin).toBe(true)
    expect(r.holds).toEqual([])
  })

  test('hold=51 shrink → not blocked, holds updated to 50', () => {
    const r = computeBarWidth({
      ...base,
      startHolds: [51, 51, 51],
      newWidth: 900,
    })
    expect(r.blocked).toBe(false)
    expect(r.atMin).toBe(true)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('hold=51 shrink → bar width reflects min holds (atMin)', () => {
    const r = computeBarWidth({
      ...base,
      startHolds: [51, 51, 51],
      newWidth: 900,
    })
    // 3 * MIN_HOLD / (3 * 51) * 1000 / 1000 * 100 ≈ 98%
    expect(r.maxWidthPct).not.toBeNull()
    expect(r.maxWidthPct).toBeCloseTo((3 * MIN_HOLD) / (3 * 51) * 100, 0)
  })
})

// ── elapsedToHoldRatio / holdRatioToElapsed ───────────────

describe('elapsed ↔ holdRatio', () => {
  // effectiveHolds for f3(3000, 3000, 3000) = [3000, 3000, 3000], totalHold = 9000
  const frames = f3(3000, 3000, 3000)

  test('elapsed=0 → 0%', () => {
    expect(elapsedToHoldRatio(0, frames)).toBe(0)
  })

  test('end of frame 1 → 1/3', () => {
    expect(elapsedToHoldRatio(3000, frames)).toBeCloseTo(100 / 3, 1)
  })

  test('during transition → same as frame boundary', () => {
    expect(elapsedToHoldRatio(3200, frames)).toBeCloseTo(100 / 3, 1)
  })

  test('mid frame 2 → ~50%', () => {
    expect(elapsedToHoldRatio(3000 + TRANSITION_MS + 1500, frames)).toBeCloseTo(50, 1)
  })

  test('holdRatio=0 → 0', () => {
    expect(holdRatioToElapsed(0, frames)).toBe(0)
  })

  test('holdRatio=0.5 → mid frame 2', () => {
    expect(holdRatioToElapsed(0.5, frames)).toBe(3000 + TRANSITION_MS + 1500)
  })

  test('holdRatio=1.0 → end', () => {
    expect(holdRatioToElapsed(1.0, frames)).toBe(3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000)
  })

  test('round-trip', () => {
    const original = 3000 + TRANSITION_MS + 500
    const ratio = elapsedToHoldRatio(original, frames) / 100
    const back = holdRatioToElapsed(ratio, frames)
    expect(back).toBeCloseTo(original, 0)
  })

  test('empty frames → 0', () => {
    expect(elapsedToHoldRatio(1000, [])).toBe(0)
    expect(holdRatioToElapsed(0.5, [])).toBe(0)
  })
})

// ── Table tests: edge drag scenarios ─────────────────────

describe('edge drag scenarios', () => {
  test.each([
    {
      name: '8.8s → shrink to ~4.4s',
      startHolds: [2500, 2500, 3000],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 500,
      expectAtMin: false,
      expectBlocked: false,
      expectMaxWidth: 50,
    },
    {
      name: '8.8s → shrink to min',
      startHolds: [2500, 2500, 3000],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 10,
      expectAtMin: true,
      expectBlocked: false,
      expectMaxWidth: (3 * MIN_HOLD) / (2500 + 2500 + 3000) * 100,
    },
    {
      name: 'already at min → shrink blocked',
      startHolds: [50, 50, 50],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 500,
      expectAtMin: true,
      expectBlocked: true,
      expectMaxWidth: null,
    },
    {
      name: 'hold=51 → shrinks to 50, bar reflects min width',
      startHolds: [51, 51, 51],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 900,
      expectAtMin: true,
      expectBlocked: false,
      expectMaxWidth: (3 * MIN_HOLD) / (3 * 51) * 100,
    },
    {
      name: 'extend beyond wrapper',
      startHolds: [2000, 2000, 2000],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 1500,
      expectAtMin: false,
      expectBlocked: false,
      expectMaxWidth: null,
    },
    {
      name: 'extend from min',
      startHolds: [50, 50, 50],
      wrapperWidth: 1000,
      startWidth: 100,
      newWidth: 500,
      expectAtMin: false,
      expectBlocked: false,
      expectMaxWidth: 50,
    },
  ])('$name', ({ startHolds, wrapperWidth, startWidth, newWidth, expectAtMin, expectBlocked, expectMaxWidth }) => {
    const frameIds = startHolds.map((_, i) => `f${i}`)
    const r = computeBarWidth({ startHolds, frameIds, wrapperWidth, startWidth, newWidth })

    expect(r.atMin).toBe(expectAtMin)
    expect(r.blocked).toBe(expectBlocked)

    if (expectMaxWidth === null) {
      expect(r.maxWidthPct).toBeNull()
    } else {
      expect(r.maxWidthPct).toBeCloseTo(expectMaxWidth, 0)
    }

    if (!r.blocked) {
      r.holds.forEach(h => {
        expect(h.hold).toBeGreaterThanOrEqual(MIN_HOLD)
        expect(Number.isFinite(h.hold)).toBe(true)
      })
    }
  })
})

// ── Property: holds never below MIN_HOLD ─────────────────

describe('property: holds never below MIN_HOLD', () => {
  const scales = [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 1, 1.5, 2, 10]
  const holdSets = [[2000, 2000, 2000], [50, 50, 50], [51, 51, 51], [100, 50, 200], [0, 0, 0]]

  holdSets.forEach(startHolds => {
    scales.forEach(scale => {
      test(`startHolds=[${startHolds}] scale=${scale}`, () => {
        const ids = startHolds.map((_, i) => `f${i}`)
        const r = computeEdgeDrag(startHolds, ids, scale)
        r.holds.forEach(h => {
          expect(h.hold).toBeGreaterThanOrEqual(MIN_HOLD)
          expect(Number.isFinite(h.hold)).toBe(true)
        })
      })
    })
  })
})

// ── Property: redistribute preserves total ───────────────

describe('property: redistribute preserves combined total', () => {
  const holdPairs = [[2000, 2000], [50, 50], [100, 3000], [51, 50]]
  const newValues = [0, 50, 100, 1000, 5000, -100]

  holdPairs.forEach(([h1, h2]) => {
    newValues.forEach(nv => {
      test(`[${h1},${h2}] newThis=${nv}`, () => {
        const frames = [
          { id: 'a', code: 'x', hold: h1 },
          { id: 'b', code: 'y', hold: h2 },
          { id: 'c', code: 'z', hold: 999 },
        ]
        const r = redistributeHolds(frames, 0, nv)
        expect(r[0].hold + r[1].hold).toBe(h1 + h2)
        expect(r[0].hold).toBeGreaterThanOrEqual(MIN_HOLD)
        expect(r[1].hold).toBeGreaterThanOrEqual(MIN_HOLD)
      })
    })
  })
})

// ── Boundary: holdOf edge cases ──────────────────────────

describe('boundary: holdOf', () => {
  test('hold=undefined → auto', () => {
    expect(holdOf({ code: 'a', hold: undefined })).toBe(MIN_HOLD_MS)
  })

  test('hold=NaN → NaN (caller must guard)', () => {
    expect(holdOf({ code: 'a', hold: NaN })).toBeNaN()
  })

  test('hold=negative → negative (caller must guard)', () => {
    expect(holdOf({ code: 'a', hold: -1 })).toBe(-1)
  })

  test('empty string code → 1 line', () => {
    expect(holdOf({ code: '' })).toBe(MIN_HOLD_MS)
  })

  test('trailing newline → extra line', () => {
    expect(autoHold('a\n')).toBe(Math.max(MIN_HOLD_MS, 2 * HOLD_PER_LINE_MS))
  })
})

// ── Boundary: computeSegmentPcts ─────────────────────────

describe('boundary: computeSegmentPcts', () => {
  test('single frame → 100%', () => {
    expect(computeSegmentPcts([{ id: 'a', code: 'x', hold: 500 }])).toEqual([100])
  })

  test('one zero + one non-zero → [0, 100]', () => {
    const pcts = computeSegmentPcts([
      { id: 'a', code: 'x', hold: 0 },
      { id: 'b', code: 'x', hold: 100 },
    ])
    expect(pcts[0]).toBe(0)
    expect(pcts[1]).toBe(100)
  })

  test('very large hold difference', () => {
    const pcts = computeSegmentPcts([
      { id: 'a', code: 'x', hold: 1 },
      { id: 'b', code: 'x', hold: 999999 },
    ])
    expect(pcts[0]).toBeCloseTo(0, 2)
    expect(pcts[1]).toBeCloseTo(100, 2)
    expect(pcts[0] + pcts[1]).toBeCloseTo(100)
  })
})

// ── Boundary: computeTotalMs ─────────────────────────────

describe('boundary: computeTotalMs', () => {
  test('2 frames = 1 transition (last frame padded)', () => {
    const frames = [
      { id: 'a', code: 'x', hold: 100 },
      { id: 'b', code: 'x', hold: 100 },
    ]
    // effectiveHolds = [100, 3000], total = 3100 + TRANSITION_MS
    expect(computeTotalMs(frames)).toBe(100 + FH + TRANSITION_MS)
  })

  test('10 frames = 9 transitions (last frame padded)', () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, code: 'x', hold: 100 }))
    // effectiveHolds = [100*9, 3000] = 900 + 3000 = 3900
    expect(computeTotalMs(frames)).toBe(9 * 100 + FH + 9 * TRANSITION_MS)
  })
})

// ── Boundary: formatDuration ─────────────────────────────

describe('boundary: formatDuration', () => {
  test.each([
    [9999, '10.0s'],
    [10000, '10s'],
    [10001, '10s'],
    [49, '0.0s'],
    [50, '0.1s'],
    [99, '0.1s'],
    [100, '0.1s'],
    [999, '1.0s'],
    [1000, '1.0s'],
    [1049, '1.0s'],
    [1050, '1.1s'],
  ])('%ims → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})

// ── Boundary: redistributeHolds ──────────────────────────

describe('boundary: redistributeHolds', () => {
  test('combined = 2*MIN_HOLD → each gets exactly MIN_HOLD', () => {
    const frames = f3(MIN_HOLD, MIN_HOLD, 999)
    const r = redistributeHolds(frames, 0, 0)
    expect(r[0].hold).toBe(MIN_HOLD)
    expect(r[1].hold).toBe(MIN_HOLD)
  })

  test('combined = 2*MIN_HOLD → request=MIN_HOLD → exact split', () => {
    const frames = f3(MIN_HOLD, MIN_HOLD, 999)
    const r = redistributeHolds(frames, 0, MIN_HOLD)
    expect(r[0].hold).toBe(MIN_HOLD)
    expect(r[1].hold).toBe(MIN_HOLD)
  })

  test('newHoldThis = exactly combined - MIN_HOLD', () => {
    const frames = f3(1000, 500, 999)
    const r = redistributeHolds(frames, 0, 1500 - MIN_HOLD)
    expect(r[0].hold).toBe(1500 - MIN_HOLD)
    expect(r[1].hold).toBe(MIN_HOLD)
  })

  test('newHoldThis = exactly MIN_HOLD', () => {
    const frames = f3(1000, 500, 999)
    const r = redistributeHolds(frames, 0, MIN_HOLD)
    expect(r[0].hold).toBe(MIN_HOLD)
    expect(r[1].hold).toBe(1500 - MIN_HOLD)
  })

  test('newHoldThis = MIN_HOLD - 1 → clamped to MIN_HOLD', () => {
    const frames = f3(1000, 500, 999)
    const r = redistributeHolds(frames, 0, MIN_HOLD - 1)
    expect(r[0].hold).toBe(MIN_HOLD)
  })

  test('newHoldThis = combined - MIN_HOLD + 1 → clamped', () => {
    const frames = f3(1000, 500, 999)
    const r = redistributeHolds(frames, 0, 1500 - MIN_HOLD + 1)
    expect(r[0].hold).toBe(1500 - MIN_HOLD)
  })
})

// ── Boundary: computeEdgeDrag scale=1 ────────────────────

describe('boundary: computeEdgeDrag at scale boundaries', () => {
  test('scale=1 → holds unchanged', () => {
    const r = computeEdgeDrag([2000, 3000], ['a', 'b'], 1)
    expect(r.holds.map(h => h.hold)).toEqual([2000, 3000])
    expect(r.allAtMin).toBe(false)
  })

  test('scale=0 → all clamped to MIN_HOLD', () => {
    const r = computeEdgeDrag([2000, 3000], ['a', 'b'], 0)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
    expect(r.allAtMin).toBe(true)
  })

  test('scale=-1 → all clamped to MIN_HOLD', () => {
    const r = computeEdgeDrag([2000, 3000], ['a', 'b'], -1)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('scale=Infinity → very large holds', () => {
    const r = computeEdgeDrag([100, 100], ['a', 'b'], Infinity)
    r.holds.forEach(h => expect(h.hold).toBe(Infinity))
  })

  test('startHolds contains 0 → clamped to MIN_HOLD', () => {
    const r = computeEdgeDrag([0, 0, 0], ['a', 'b', 'c'], 2)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('single frame', () => {
    const r = computeEdgeDrag([1000], ['a'], 0.5)
    expect(r.holds).toEqual([{ id: 'a', hold: 500 }])
  })

  test('hold=MIN_HOLD with scale=1 → startAllAtMin=true', () => {
    const r = computeEdgeDrag([MIN_HOLD], ['a'], 1)
    expect(r.startAllAtMin).toBe(true)
    expect(r.allAtMin).toBe(true)
  })

  test('hold=MIN_HOLD+1 with scale=1 → startAllAtMin=false', () => {
    const r = computeEdgeDrag([MIN_HOLD + 1], ['a'], 1)
    expect(r.startAllAtMin).toBe(false)
    expect(r.allAtMin).toBe(false)
  })

  test('rounding boundary: hold=51, scale that rounds to exactly 50', () => {
    // 51 * (50/51) = 50.0 → Math.round(50) = 50
    const r = computeEdgeDrag([51], ['a'], 50 / 51)
    expect(r.holds[0].hold).toBe(50)
    expect(r.allAtMin).toBe(true)
  })

  test('rounding boundary: hold=51, scale that rounds to 51', () => {
    // 51 * (51/51) = 51 → stays 51
    const r = computeEdgeDrag([51], ['a'], 1)
    expect(r.holds[0].hold).toBe(51)
    expect(r.allAtMin).toBe(false)
  })
})

// ── Boundary: computeBarWidth ────────────────────────────

describe('boundary: computeBarWidth', () => {
  const base = {
    wrapperWidth: 1000,
    startWidth: 1000,
    startHolds: [2000, 2000],
    frameIds: ['a', 'b'],
  }

  test('newWidth = startWidth → scale=1, no maxWidth', () => {
    const r = computeBarWidth({ ...base, newWidth: 1000 })
    expect(r.maxWidthPct).toBeNull()
    expect(r.atMin).toBe(false)
    expect(r.holds.map(h => h.hold)).toEqual([2000, 2000])
  })

  test('newWidth = wrapperWidth → no maxWidth', () => {
    const r = computeBarWidth({ ...base, newWidth: 1000 })
    expect(r.maxWidthPct).toBeNull()
  })

  test('newWidth = wrapperWidth + 1 → no maxWidth', () => {
    const r = computeBarWidth({ ...base, newWidth: 1001 })
    expect(r.maxWidthPct).toBeNull()
  })

  test('newWidth = wrapperWidth - 1 → maxWidth set', () => {
    const r = computeBarWidth({ ...base, newWidth: 999 })
    expect(r.maxWidthPct).toBeCloseTo(99.9)
  })

  test('newWidth = 0 → clamped internally, all at min', () => {
    const r = computeBarWidth({ ...base, newWidth: 0 })
    expect(r.atMin).toBe(true)
    r.holds.forEach(h => expect(h.hold).toBe(MIN_HOLD))
  })

  test('startWidth = 0 → scale=Infinity', () => {
    const r = computeBarWidth({ ...base, startWidth: 0, newWidth: 500 })
    // scale = 500/0 = Infinity → holds = Infinity
    r.holds.forEach(h => expect(h.hold).toBe(Infinity))
  })

  test('startHolds mixed: one at MIN_HOLD, one above', () => {
    const r = computeBarWidth({
      ...base,
      startHolds: [MIN_HOLD, 2000],
      newWidth: 500,
    })
    expect(r.blocked).toBe(false)
    expect(r.holds[0].hold).toBe(MIN_HOLD) // was already at min, can't go lower
    expect(r.holds[1].hold).toBe(1000)
  })
})

// ── Boundary: elapsedToHoldRatio ─────────────────────────

describe('boundary: elapsedToHoldRatio', () => {
  // Use holds >= FH so padding doesn't affect: effectiveHolds = [3000, 3000, 3000], totalHold = 9000
  const frames = f3(3000, 3000, 3000)

  test('negative elapsed → 0%', () => {
    expect(elapsedToHoldRatio(-100, frames)).toBe(0)
  })

  test('elapsed = exactly total timeline → 100%', () => {
    const totalTimeline = 3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000
    expect(elapsedToHoldRatio(totalTimeline, frames)).toBe(100)
  })

  test('elapsed > total timeline → capped at 100%', () => {
    const totalTimeline = 3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000
    expect(elapsedToHoldRatio(totalTimeline + 9999, frames)).toBe(100)
  })

  test('elapsed at exact transition start → frame boundary', () => {
    // Frame 1 ends at 3000, transition is 3000..3400
    expect(elapsedToHoldRatio(3000, frames)).toBeCloseTo(100 / 3)
    expect(elapsedToHoldRatio(3001, frames)).toBeCloseTo(100 / 3)
  })

  test('elapsed at exact transition end → frame boundary', () => {
    expect(elapsedToHoldRatio(3000 + TRANSITION_MS, frames)).toBeCloseTo(100 / 3)
  })

  test('elapsed 1ms into frame 2 → slightly past 1/3', () => {
    const ratio = elapsedToHoldRatio(3000 + TRANSITION_MS + 1, frames)
    expect(ratio).toBeGreaterThan(100 / 3)
  })

  test('single frame: elapsed=0 → 0%', () => {
    expect(elapsedToHoldRatio(0, [{ id: 'a', code: 'x', hold: 5000 }])).toBe(0)
  })

  test('single frame: elapsed=2500 → 50%', () => {
    // hold=5000 → effectiveHolds = [5000] (>= FH), so 2500/5000 = 50%
    expect(elapsedToHoldRatio(2500, [{ id: 'a', code: 'x', hold: 5000 }])).toBe(50)
  })

  test('single frame: elapsed=5000 → 100%', () => {
    expect(elapsedToHoldRatio(5000, [{ id: 'a', code: 'x', hold: 5000 }])).toBe(100)
  })

  test('frames with hold=0 → all at 0%', () => {
    expect(elapsedToHoldRatio(0, f3(0, 0, 0))).toBe(0)
  })
})

// ── Boundary: holdRatioToElapsed ─────────────────────────

describe('boundary: holdRatioToElapsed', () => {
  // Use holds >= FH so padding doesn't affect: effectiveHolds = [3000, 3000, 3000], totalHold = 9000
  const frames = f3(3000, 3000, 3000)

  test('ratio=0 → 0', () => {
    expect(holdRatioToElapsed(0, frames)).toBe(0)
  })

  test('ratio=1 → full timeline', () => {
    expect(holdRatioToElapsed(1, frames)).toBe(3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000)
  })

  test('ratio slightly > 0 → small elapsed in frame 1', () => {
    const elapsed = holdRatioToElapsed(0.001, frames)
    expect(elapsed).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
  })

  test('ratio at exact frame boundary 1/3', () => {
    const elapsed = holdRatioToElapsed(1 / 3, frames)
    expect(elapsed).toBe(3000)
  })

  test('ratio at exact frame boundary 2/3', () => {
    const elapsed = holdRatioToElapsed(2 / 3, frames)
    expect(elapsed).toBe(3000 + TRANSITION_MS + 3000)
  })

  test('ratio > 1 → clamped to end', () => {
    const elapsed = holdRatioToElapsed(1.5, frames)
    expect(elapsed).toBe(3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000)
  })

  test('ratio < 0 → 0', () => {
    expect(holdRatioToElapsed(-0.5, frames)).toBe(0)
  })

  test('single frame ratio=0.5 → no transitions', () => {
    // hold=6000 → effectiveHolds = [6000] (>= FH), 0.5 * 6000 = 3000
    expect(holdRatioToElapsed(0.5, [{ id: 'a', code: 'x', hold: 6000 }])).toBe(3000)
  })

  test('unequal holds: ratio maps proportionally', () => {
    const frames = [
      { id: 'a', code: 'x', hold: 3000 },
      { id: 'b', code: 'x', hold: 5000 },
    ]
    // effectiveHolds = [3000, 5000] (last >= FH), totalHold = 8000
    // ratio=3/8 → 3000ms → end of frame 1
    expect(holdRatioToElapsed(3 / 8, frames)).toBe(3000)
    // ratio=0.5 → 4000ms → 1000ms into frame 2 + transition
    expect(holdRatioToElapsed(0.5, frames)).toBe(3000 + TRANSITION_MS + 1000)
  })
})

// ── Round-trip: ratio conversion with various frame configs ──

describe('round-trip: elapsedToHoldRatio ↔ holdRatioToElapsed', () => {
  const configs: Array<{ name: string; frames: FrameInput[] }> = [
    { name: 'equal 3 frames', frames: f3(3000, 3000, 3000) },
    { name: 'unequal', frames: f3(3000, 4000, 5000) },
    { name: 'at minimum', frames: f3(50, 50, 3000) }, // last frame >= FH
    { name: 'single frame', frames: [{ id: 'a', code: 'x', hold: 5000 }] },
    { name: 'two frames', frames: [{ id: 'a', code: 'x', hold: 3000 }, { id: 'b', code: 'x', hold: 4000 }] },
  ]

  const ratios = [0, 0.001, 0.1, 0.25, 1/3, 0.5, 2/3, 0.75, 0.999, 1.0]

  configs.forEach(({ name, frames }) => {
    ratios.forEach(ratio => {
      test(`${name}, ratio=${ratio.toFixed(3)}`, () => {
        const elapsed = holdRatioToElapsed(ratio, frames)
        const backRatio = elapsedToHoldRatio(elapsed, frames) / 100
        expect(backRatio).toBeCloseTo(ratio, 3)
      })
    })
  })
})

// ── computeExtensionHolds ───────────────────────────────

describe('computeExtensionHolds', () => {
  test('small holds get meaningful increase from modest drag', () => {
    const holds = computeExtensionHolds([54, 54, 54], ['a', 'b', 'c'], 100, 1200)
    const total = holds.reduce((s, h) => s + h.hold, 0)
    expect(total).toBeGreaterThan(54 * 3 + 400)
  })

  test('auto-sized holds use normal proportional scaling', () => {
    const startHolds = [2500, 2500, 3000]
    const startWidth = 1200
    const totalStart = startHolds.reduce((s, h) => s + h, 0)
    const normalMsPerPx = totalStart / startWidth
    const pixelsPast = 100
    const holds = computeExtensionHolds(startHolds, ['a', 'b', 'c'], pixelsPast, startWidth)
    const totalResult = holds.reduce((s, h) => s + h.hold, 0)
    const expectedTotal = Math.round(totalStart + pixelsPast * normalMsPerPx)
    expect(totalResult).toBeCloseTo(expectedTotal, -1)
  })

  test('holds never go below MIN_HOLD', () => {
    const holds = computeExtensionHolds([0, 0, 0], ['a', 'b', 'c'], 0, 1200)
    holds.forEach(h => expect(h.hold).toBeGreaterThanOrEqual(MIN_HOLD))
  })

  test('preserves proportions between frames', () => {
    const holds = computeExtensionHolds([100, 200, 300], ['a', 'b', 'c'], 100, 1200)
    expect(holds[1].hold / holds[0].hold).toBeCloseTo(2, 0)
    expect(holds[2].hold / holds[0].hold).toBeCloseTo(3, 0)
  })

  test('pixelsPast=0 returns original holds', () => {
    const holds = computeExtensionHolds([54, 54, 54], ['a', 'b', 'c'], 0, 1200)
    expect(holds.map(h => h.hold)).toEqual([54, 54, 54])
  })

  test('minimum ms/px rate guarantees responsiveness', () => {
    const holds = computeExtensionHolds([MIN_HOLD, MIN_HOLD], ['a', 'b'], 200, 1200)
    const total = holds.reduce((s, h) => s + h.hold, 0)
    expect(total).toBeGreaterThanOrEqual(MIN_HOLD * 2 + 200 * MIN_EXTEND_MS_PER_PX)
  })

  test('startWidth=0 still applies minimum ms/px rate', () => {
    const holds = computeExtensionHolds([54, 54], ['a', 'b'], 100, 0)
    const total = holds.reduce((s, h) => s + h.hold, 0)
    expect(total).toBeGreaterThan(54 * 2)
  })
})

// ── isAtMinHold ─────────────────────────────────────────

describe('isAtMinHold', () => {
  test('hold === MIN_HOLD → true', () => {
    expect(isAtMinHold({ code: 'x', hold: MIN_HOLD })).toBe(true)
  })

  test('hold < MIN_HOLD → true', () => {
    expect(isAtMinHold({ code: 'x', hold: 0 })).toBe(true)
  })

  test('hold === MIN_HOLD + 1 → false', () => {
    expect(isAtMinHold({ code: 'x', hold: MIN_HOLD + 1 })).toBe(false)
  })

  test('hold === undefined (auto) → false', () => {
    expect(isAtMinHold({ code: 'x' })).toBe(false)
  })

  test('large hold → false', () => {
    expect(isAtMinHold({ code: 'x', hold: 5000 })).toBe(false)
  })
})

// ── Idempotency: repeated calls produce same results ────

describe('idempotency: drag functions return consistent results', () => {
  test('computeSegmentDrag same ratio twice → identical', () => {
    const frames: FrameInput[] = [
      { id: 'a', code: 'x', hold: 2000 },
      { id: 'b', code: 'y', hold: 2000 },
      { id: 'c', code: 'z', hold: 2000 },
    ]
    const r1 = computeSegmentDrag(0.4, 0, frames)
    const r2 = computeSegmentDrag(0.4, 0, frames)
    expect(r1).toEqual(r2)
  })

  test('computeBarWidth at identity → no change', () => {
    const params = {
      newWidth: 1000,
      startWidth: 1000,
      wrapperWidth: 1000,
      startHolds: [2000, 2000, 2000],
      frameIds: ['a', 'b', 'c'],
    }
    const r = computeBarWidth(params)
    expect(r.holds.map(h => h.hold)).toEqual([2000, 2000, 2000])
    expect(r.atMin).toBe(false)
    expect(r.blocked).toBe(false)
  })

  test('computeBarWidth called twice with same params → identical', () => {
    const params = {
      newWidth: 500,
      startWidth: 1000,
      wrapperWidth: 1000,
      startHolds: [2000, 2000, 2000],
      frameIds: ['a', 'b', 'c'],
    }
    const r1 = computeBarWidth(params)
    const r2 = computeBarWidth(params)
    expect(r1).toEqual(r2)
  })
})

// ── hoverTimeLabel ──────────────────────────────────────

describe('hoverTimeLabel', () => {
  // Use holds >= FH so padding doesn't affect: effectiveHolds = [3000, 3000, 3000], totalHold = 9000
  const frames: FrameInput[] = [
    { id: 'a', code: 'x', hold: 3000 },
    { id: 'b', code: 'y', hold: 3000 },
    { id: 'c', code: 'z', hold: 3000 },
  ]

  test('ratio=0 → 0.0s', () => {
    expect(hoverTimeLabel(0, frames)).toBe('0.0s')
  })

  test('ratio=0.5 → mid-timeline', () => {
    const label = hoverTimeLabel(0.5, frames)
    expect(label).toMatch(/^\d+\.\d+s$/)
  })

  test('ratio=1 → total duration', () => {
    const label = hoverTimeLabel(1, frames)
    expect(label).toBe(formatDuration(3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000))
  })

  test('empty frames → 0.0s', () => {
    expect(hoverTimeLabel(0.5, [])).toBe('0.0s')
  })

  test('single frame ratio=0.5 → half hold', () => {
    const single = [{ id: 'a', code: 'x', hold: 4000 }]
    // effectiveHolds = [4000] (>= FH), 0.5 * 4000 = 2000
    expect(hoverTimeLabel(0.5, single)).toBe('2.0s')
  })
})

// ── computeBarWidthPct ───────────────────────────────────

describe('computeBarWidthPct', () => {
  test('single frame at BASE_DURATION_MS → ≈100%', () => {
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: BASE_DURATION_MS }]
    expect(computeBarWidthPct(frames)).toBeCloseTo(100, 0)
  })

  test('empty frames → 0%', () => {
    expect(computeBarWidthPct([])).toBe(0)
  })

  test('single frame hold=FH → FH/BASE * 100', () => {
    // hold=FH → effectiveHolds = [FH], totalMs = FH
    const frames: FrameInput[] = [{ id: 'a', code: 'x', hold: FH }]
    expect(computeBarWidthPct(frames)).toBeCloseTo((FH / BASE_DURATION_MS) * 100, 0)
  })

  test('many frames → wider than single frame', () => {
    const few: FrameInput[] = [{ id: 'a', code: 'x', hold: 3000 }]
    const many: FrameInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`, code: 'x', hold: 3000,
    }))
    expect(computeBarWidthPct(many)).toBeGreaterThan(computeBarWidthPct(few))
  })

  test('double duration → double width', () => {
    const short: FrameInput[] = [{ id: 'a', code: 'x', hold: 5000 }]
    const long: FrameInput[] = [{ id: 'a', code: 'x', hold: 10000 }]
    const ratio = computeBarWidthPct(long) / computeBarWidthPct(short)
    expect(ratio).toBeCloseTo(2, 0)
  })
})

// ── elapsedToPlayheadPct ────────────────────────────────

describe('elapsedToPlayheadPct', () => {
  // Use holds >= FH: effectiveHolds = [3000, 3000, 3000], totalHold = 9000
  const frames: FrameInput[] = [
    { id: 'a', code: 'x', hold: 3000 },
    { id: 'b', code: 'y', hold: 3000 },
    { id: 'c', code: 'z', hold: 3000 },
  ]
  const totalDuration = 3000 + TRANSITION_MS + 3000 + TRANSITION_MS + 3000

  test('elapsed=0 → 0%', () => {
    expect(elapsedToPlayheadPct(0, frames)).toBe(0)
  })

  test('elapsed=totalDuration → 100%', () => {
    expect(elapsedToPlayheadPct(totalDuration, frames)).toBe(100)
  })

  test('mid-timeline → ~50%', () => {
    // mid-timeline: half of totalDuration
    // At 3000 + 200 + 1500 = 4700, holdRatio = (3000+1500)/9000*100 = 50%
    const midElapsed = 3000 + TRANSITION_MS + 1500
    expect(elapsedToPlayheadPct(midElapsed, frames)).toBeCloseTo(50, 1)
  })

  test('freezes during transition (delegates to holdRatio)', () => {
    const endOfFrame1 = 3000
    const midTransition = endOfFrame1 + TRANSITION_MS / 2
    const pctEnd = elapsedToPlayheadPct(endOfFrame1, frames)
    const pctMid = elapsedToPlayheadPct(midTransition, frames)
    // During transition, playhead freezes at the segment boundary
    expect(pctMid).toBe(pctEnd)
  })

  test('empty frames → 0%', () => {
    expect(elapsedToPlayheadPct(1000, [])).toBe(0)
  })

  test('single frame has no transitions', () => {
    const single = [{ id: 'a', code: 'x', hold: 4000 }]
    // effectiveHolds = [4000] (>= FH), 2000/4000 = 50%
    expect(elapsedToPlayheadPct(2000, single)).toBe(50)
  })

  test('capped at 100%', () => {
    expect(elapsedToPlayheadPct(totalDuration + 1000, frames)).toBe(100)
  })
})

// ── Edge drag cursor tracking: pixel → hold → barWidthPct round-trip ──

describe('edge drag cursor tracking', () => {
  const startHolds = [3000, 3000, 3000]
  const frameIds = ['a', 'b', 'c']
  const startTotalHold = 9000
  const transitions = 2 * TRANSITION_MS
  const wrapperWidth = 1000

  /**
   * Simulate an edge drag that targets a desired pixel position.
   * Accounts for final-frame padding: the last frame is padded to at least FH
   * by computeTotalMs/effectiveHolds, so we solve for holds that produce the
   * desired totalMs after padding.
   */
  const simulateDrag = (desiredPx: number) => {
    const desiredTotalMs = (desiredPx / wrapperWidth) * BASE_DURATION_MS
    // Desired total hold = desiredTotalMs - transitions, but last frame is padded to FH
    // if below threshold. For N equal holds h: effective = [h, h, ..., max(h, FH)].
    // totalHold = (N-1)*h + max(h, FH). We want (N-1)*h + max(h, FH) + transitions = desiredTotalMs.
    const n = frameIds.length
    const desiredHoldTotal = Math.max(n * MIN_HOLD, desiredTotalMs - transitions)

    // If all holds are equal h: effectiveTotal = (n-1)*h + max(h, FH)
    // Case 1: h >= FH → effectiveTotal = n*h → h = desiredHoldTotal / n
    // Case 2: h < FH → effectiveTotal = (n-1)*h + FH → h = (desiredHoldTotal - FH) / (n-1)
    let h: number
    const hIfNopad = desiredHoldTotal / n
    if (hIfNopad >= FH) {
      h = hIfNopad
    } else {
      // (n-1)*h + FH = desiredHoldTotal → h = (desiredHoldTotal - FH) / (n - 1)
      h = Math.max(MIN_HOLD, (desiredHoldTotal - FH) / (n - 1))
    }
    h = Math.max(MIN_HOLD, Math.round(h))

    const holds: FrameInput[] = frameIds.map((id) => ({
      id,
      code: 'x',
      hold: h,
    }))
    return { holds, desiredPx }
  }

  test('bar edge matches cursor at large width (holds >= FH)', () => {
    // Use desiredPx large enough that all holds >= FH (no padding needed)
    // desiredTotalMs = (px/1000)*2900, holds = desiredTotalMs - 800, h = holds/3
    // h >= 3000 when holds >= 9000, desiredTotalMs >= 9800, px >= 9800/2900*1000 ≈ 3379
    const desiredPx = 3400
    const { holds } = simulateDrag(desiredPx)
    const barPct = computeBarWidthPct(holds)
    const barPx = (barPct / 100) * wrapperWidth
    expect(barPx).toBeCloseTo(desiredPx, 0)
  })

  test('bar edge matches cursor at moderate width (with padding)', () => {
    // desiredPx = 2000 → desiredTotalMs = 5800, desiredHoldTotal = 5000
    // h = (5000 - 3000) / 2 = 1000, effective = [1000, 1000, 3000] = 5000, total = 5800
    const desiredPx = 2000
    const { holds } = simulateDrag(desiredPx)
    const barPct = computeBarWidthPct(holds)
    const barPx = (barPct / 100) * wrapperWidth
    expect(barPx).toBeCloseTo(desiredPx, 0)
  })

  test('bar edge matches cursor at very large width (scrollable)', () => {
    const desiredPx = 5000
    const { holds } = simulateDrag(desiredPx)
    const barPct = computeBarWidthPct(holds)
    const barPx = (barPct / 100) * wrapperWidth
    expect(barPx).toBeCloseTo(desiredPx, 0)
  })

  test('shrink to minimum clamps holds at MIN_HOLD', () => {
    const { holds } = simulateDrag(10)
    holds.forEach(h => expect(h.hold).toBeGreaterThanOrEqual(MIN_HOLD))
  })

  test('holds never go below MIN_HOLD at any drag position', () => {
    for (const px of [1, 50, 100, 300, 500, 1000, 2000, 5000]) {
      const { holds } = simulateDrag(px)
      holds.forEach(h => expect(h.hold).toBeGreaterThanOrEqual(MIN_HOLD))
    }
  })
})
