import { describe, expect, test } from 'vitest'
import {
  autoHold,
  holdOf,
  formatDuration,
  computeSegmentPcts,
  computeTotalMs,
  redistributeHolds,
  scaleAllHolds,
  computeEdgeDrag,
  elapsedToHoldRatio,
  holdRatioToElapsed,
  computeBarWidth,
  MIN_HOLD,
  MIN_HOLD_MS,
  HOLD_PER_LINE_MS,
  TRANSITION_MS,
  type FrameInput,
} from './timeline-logic'

// ── Helpers ──────────────────────────────────────────────

const f = (code: string, hold?: number): FrameInput => ({ id: `f${Math.random().toString(36).slice(2, 6)}`, code, hold })
const f3 = (h1: number, h2: number, h3: number): FrameInput[] => [
  { id: 'a', code: 'x', hold: h1 },
  { id: 'b', code: 'y', hold: h2 },
  { id: 'c', code: 'z', hold: h3 },
]

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
    const pcts = computeSegmentPcts(f3(1000, 1000, 1000))
    pcts.forEach(p => expect(p).toBeCloseTo(100 / 3, 5))
  })

  test('pcts sum to 100', () => {
    const pcts = computeSegmentPcts(f3(500, 1500, 3000))
    expect(pcts.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })

  test('empty → empty', () => {
    expect(computeSegmentPcts([])).toEqual([])
  })

  test('all zero holds → all 0%', () => {
    expect(computeSegmentPcts(f3(0, 0, 0))).toEqual([0, 0, 0])
  })

  test('never NaN', () => {
    computeSegmentPcts(f3(0, 0, 0)).forEach(p => expect(Number.isFinite(p)).toBe(true))
  })
})

// ── computeTotalMs ───────────────────────────────────────

describe('computeTotalMs', () => {
  test.each([
    { frames: f3(2500, 2500, 3000), expected: 8000 + 2 * TRANSITION_MS },
    { frames: [f('a', 1000)], expected: 1000 },
    { frames: [], expected: 0 },
    { frames: f3(50, 50, 50), expected: 150 + 2 * TRANSITION_MS },
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

  test('shrink to min → atMin, no maxWidthPct change', () => {
    const r = computeBarWidth({ ...base, newWidth: 10 })
    expect(r.atMin).toBe(true)
    expect(r.maxWidthPct).toBeNull()
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

  test('hold=51 shrink → bar width not changed (atMin)', () => {
    const r = computeBarWidth({
      ...base,
      startHolds: [51, 51, 51],
      newWidth: 900,
    })
    expect(r.maxWidthPct).toBeNull()
  })
})

// ── elapsedToHoldRatio / holdRatioToElapsed ───────────────

describe('elapsed ↔ holdRatio', () => {
  const frames = f3(2000, 2000, 2000)

  test('elapsed=0 → 0%', () => {
    expect(elapsedToHoldRatio(0, frames)).toBe(0)
  })

  test('end of frame 1 → 1/3', () => {
    expect(elapsedToHoldRatio(2000, frames)).toBeCloseTo(100 / 3, 1)
  })

  test('during transition → same as frame boundary', () => {
    expect(elapsedToHoldRatio(2200, frames)).toBeCloseTo(100 / 3, 1)
  })

  test('mid frame 2 → ~50%', () => {
    expect(elapsedToHoldRatio(2000 + TRANSITION_MS + 1000, frames)).toBeCloseTo(50, 1)
  })

  test('holdRatio=0 → 0', () => {
    expect(holdRatioToElapsed(0, frames)).toBe(0)
  })

  test('holdRatio=0.5 → mid frame 2', () => {
    expect(holdRatioToElapsed(0.5, frames)).toBe(2000 + TRANSITION_MS + 1000)
  })

  test('holdRatio=1.0 → end', () => {
    expect(holdRatioToElapsed(1.0, frames)).toBe(2000 + TRANSITION_MS + 2000 + TRANSITION_MS + 2000)
  })

  test('round-trip', () => {
    const original = 2000 + TRANSITION_MS + 500
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
      expectMaxWidth: null,
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
      name: 'hold=51 → shrinks to 50, no bar shrink',
      startHolds: [51, 51, 51],
      wrapperWidth: 1000,
      startWidth: 1000,
      newWidth: 900,
      expectAtMin: true,
      expectBlocked: false,
      expectMaxWidth: null,
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
  test('2 frames = 1 transition', () => {
    const frames = [
      { id: 'a', code: 'x', hold: 100 },
      { id: 'b', code: 'x', hold: 100 },
    ]
    expect(computeTotalMs(frames)).toBe(200 + TRANSITION_MS)
  })

  test('10 frames = 9 transitions', () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, code: 'x', hold: 100 }))
    expect(computeTotalMs(frames)).toBe(1000 + 9 * TRANSITION_MS)
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
  const frames = f3(2000, 2000, 2000)

  test('negative elapsed → 0%', () => {
    // rem starts negative, loop breaks immediately
    expect(elapsedToHoldRatio(-100, frames)).toBe(0)
  })

  test('elapsed = exactly total timeline → 100%', () => {
    const totalTimeline = 2000 + TRANSITION_MS + 2000 + TRANSITION_MS + 2000
    expect(elapsedToHoldRatio(totalTimeline, frames)).toBe(100)
  })

  test('elapsed > total timeline → capped at 100%', () => {
    const totalTimeline = 2000 + TRANSITION_MS + 2000 + TRANSITION_MS + 2000
    expect(elapsedToHoldRatio(totalTimeline + 9999, frames)).toBe(100)
  })

  test('elapsed at exact transition start → frame boundary', () => {
    // Frame 1 ends at 2000, transition is 2000..2400
    expect(elapsedToHoldRatio(2000, frames)).toBeCloseTo(100 / 3)
    expect(elapsedToHoldRatio(2001, frames)).toBeCloseTo(100 / 3)
  })

  test('elapsed at exact transition end → frame boundary', () => {
    expect(elapsedToHoldRatio(2000 + TRANSITION_MS, frames)).toBeCloseTo(100 / 3)
  })

  test('elapsed 1ms into frame 2 → slightly past 1/3', () => {
    const ratio = elapsedToHoldRatio(2000 + TRANSITION_MS + 1, frames)
    expect(ratio).toBeGreaterThan(100 / 3)
  })

  test('single frame: elapsed=0 → 0%', () => {
    expect(elapsedToHoldRatio(0, [{ id: 'a', code: 'x', hold: 1000 }])).toBe(0)
  })

  test('single frame: elapsed=500 → 50%', () => {
    expect(elapsedToHoldRatio(500, [{ id: 'a', code: 'x', hold: 1000 }])).toBe(50)
  })

  test('single frame: elapsed=1000 → 100%', () => {
    expect(elapsedToHoldRatio(1000, [{ id: 'a', code: 'x', hold: 1000 }])).toBe(100)
  })

  test('frames with hold=0 → all at 0%', () => {
    expect(elapsedToHoldRatio(0, f3(0, 0, 0))).toBe(0)
  })
})

// ── Boundary: holdRatioToElapsed ─────────────────────────

describe('boundary: holdRatioToElapsed', () => {
  const frames = f3(2000, 2000, 2000)

  test('ratio=0 → 0', () => {
    expect(holdRatioToElapsed(0, frames)).toBe(0)
  })

  test('ratio=1 → full timeline', () => {
    expect(holdRatioToElapsed(1, frames)).toBe(2000 + TRANSITION_MS + 2000 + TRANSITION_MS + 2000)
  })

  test('ratio slightly > 0 → small elapsed in frame 1', () => {
    const elapsed = holdRatioToElapsed(0.001, frames)
    expect(elapsed).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
  })

  test('ratio at exact frame boundary 1/3', () => {
    const elapsed = holdRatioToElapsed(1 / 3, frames)
    expect(elapsed).toBe(2000)
  })

  test('ratio at exact frame boundary 2/3', () => {
    const elapsed = holdRatioToElapsed(2 / 3, frames)
    expect(elapsed).toBe(2000 + TRANSITION_MS + 2000)
  })

  test('ratio > 1 → clamped to end', () => {
    const elapsed = holdRatioToElapsed(1.5, frames)
    expect(elapsed).toBe(2000 + TRANSITION_MS + 2000 + TRANSITION_MS + 2000)
  })

  test('ratio < 0 → 0', () => {
    expect(holdRatioToElapsed(-0.5, frames)).toBe(0)
  })

  test('single frame ratio=0.5 → no transitions', () => {
    expect(holdRatioToElapsed(0.5, [{ id: 'a', code: 'x', hold: 1000 }])).toBe(500)
  })

  test('unequal holds: ratio maps proportionally', () => {
    const frames = [
      { id: 'a', code: 'x', hold: 1000 },
      { id: 'b', code: 'x', hold: 3000 },
    ]
    // ratio=0.25 → 1000ms into total hold (1000+3000=4000), so end of frame 1
    expect(holdRatioToElapsed(0.25, frames)).toBe(1000)
    // ratio=0.5 → 2000ms into total hold → 1000ms into frame 2 + transition
    expect(holdRatioToElapsed(0.5, frames)).toBe(1000 + TRANSITION_MS + 1000)
  })
})

// ── Round-trip: ratio conversion with various frame configs ──

describe('round-trip: elapsedToHoldRatio ↔ holdRatioToElapsed', () => {
  const configs: Array<{ name: string; frames: FrameInput[] }> = [
    { name: 'equal 3 frames', frames: f3(2000, 2000, 2000) },
    { name: 'unequal', frames: f3(500, 1500, 3000) },
    { name: 'at minimum', frames: f3(50, 50, 50) },
    { name: 'single frame', frames: [{ id: 'a', code: 'x', hold: 5000 }] },
    { name: 'two frames', frames: [{ id: 'a', code: 'x', hold: 1000 }, { id: 'b', code: 'x', hold: 2000 }] },
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
