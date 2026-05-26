import { describe, expect, test } from 'bun:test'
import {
  buildTimeline,
  collapseTransitions,
  computeAutoHold,
  locateInTimeline,
} from './timeline'
import { DEFAULTS, type Spec } from './types'

const spec = (overrides?: Partial<Spec>): Spec => ({
  language: 'ts',
  frames: [
    { id: 'a', code: 'const x = 1' },
    { id: 'b', code: 'const x = 1\nconst y = 2' },
    { id: 'c', code: 'const x = 1\nconst y = 2\nconst z = 3' },
  ],
  ...overrides,
})

describe('computeAutoHold', () => {
  test('scales with line count but stays above minHoldMs', () => {
    expect(computeAutoHold('a', DEFAULTS)).toBe(DEFAULTS.minHoldMs)
    expect(computeAutoHold('a\nb\nc\nd\ne\nf', DEFAULTS)).toBe(
      6 * DEFAULTS.holdPerLineMs,
    )
  })
})

describe('buildTimeline', () => {
  test('emits hold + transition segments in order', () => {
    const t = buildTimeline(spec())
    // 3 holds + 2 transitions
    expect(t.segments).toHaveLength(5)
    expect(t.segments[0].type).toBe('hold')
    expect(t.segments[1].type).toBe('transition')
    expect(t.segments[2].type).toBe('hold')
    expect(t.segments[3].type).toBe('transition')
    expect(t.segments[4].type).toBe('hold')
  })

  test('the final hold is padded to finalFrameMinHoldMs', () => {
    const t = buildTimeline(spec())
    const lastHold = t.segments[t.segments.length - 1]
    expect(lastHold.type).toBe('hold')
    expect(lastHold.durationMs).toBeGreaterThanOrEqual(
      DEFAULTS.finalFrameMinHoldMs,
    )
  })

  test('frame.hold overrides auto-hold', () => {
    const t = buildTimeline(
      spec({
        frames: [
          { id: 'a', code: 'x', hold: 1234 },
          { id: 'b', code: 'y' },
        ],
      }),
    )
    expect(t.segments[0].type).toBe('hold')
    expect(t.segments[0].durationMs).toBe(1234)
  })

  test('frame.transition.duration overrides default transition', () => {
    const t = buildTimeline(
      spec({
        frames: [
          { id: 'a', code: 'x' },
          { id: 'b', code: 'y', transition: { duration: 90 } },
        ],
      }),
    )
    const tr = t.segments[1]
    expect(tr.type).toBe('transition')
    expect(tr.durationMs).toBe(90)
  })

  test('totalDurationMs equals the segment sum', () => {
    const t = buildTimeline(spec())
    const sum = t.segments.reduce((s, x) => s + x.durationMs, 0)
    expect(t.totalDurationMs).toBe(sum)
  })

  test('single-frame spec has no transitions', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [{ id: 'a', code: 'x' }],
    })
    expect(t.segments).toHaveLength(1)
    expect(t.segments[0].type).toBe('hold')
  })
})

describe('locateInTimeline', () => {
  test('zero elapsed lands in the first segment at progress 0', () => {
    const t = buildTimeline(spec())
    const pos = locateInTimeline(t, 0)
    expect(pos.segmentIndex).toBe(0)
    expect(pos.segmentProgress).toBe(0)
  })

  test('past-the-end clamps to the final segment', () => {
    const t = buildTimeline(spec())
    const pos = locateInTimeline(t, t.totalDurationMs + 9999)
    expect(pos.segmentIndex).toBe(t.segments.length - 1)
    expect(pos.segmentProgress).toBe(1)
  })

  test('mid-transition produces a fractional progress', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [
        { id: 'a', code: 'x', hold: 1000 },
        { id: 'b', code: 'y' },
      ],
    })
    // After 1000ms we should be at the start of the transition segment.
    const atTransitionStart = locateInTimeline(t, 1000)
    expect(atTransitionStart.segmentIndex).toBe(1)
    expect(atTransitionStart.segmentProgress).toBeCloseTo(0, 5)

    const midTransition = locateInTimeline(t, 1000 + DEFAULTS.transitionMs / 2)
    expect(midTransition.segmentIndex).toBe(1)
    expect(midTransition.segmentProgress).toBeCloseTo(0.5, 2)
  })
})

describe('collapseTransitions', () => {
  test('keeps hold segments and zeroes transition durations', () => {
    const t = buildTimeline(spec())
    const collapsed = collapseTransitions(t)
    expect(collapsed.segments).toHaveLength(t.segments.length)
    for (let i = 0; i < t.segments.length; i++) {
      if (collapsed.segments[i].type === 'transition') {
        expect(collapsed.segments[i].durationMs).toBe(0)
      } else {
        expect(collapsed.segments[i].durationMs).toBe(t.segments[i].durationMs)
      }
    }
  })

  test('totalDurationMs equals sum of hold durations only', () => {
    const t = buildTimeline(spec())
    const collapsed = collapseTransitions(t)
    const holdSum = collapsed.segments
      .filter(s => s.type === 'hold')
      .reduce((sum, s) => sum + s.durationMs, 0)
    expect(collapsed.totalDurationMs).toBe(holdSum)
  })
})

describe('buildTimeline: edge cases', () => {
  test('final frame padding does not apply when hold already exceeds minimum', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [{ id: 'a', code: 'x', hold: 10000 }],
    })
    expect(t.segments[0].durationMs).toBe(10000)
  })

  test('transition carries the correct line roles from diff', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [
        { id: 'a', code: 'a\nb' },
        { id: 'b', code: 'a\nc' },
      ],
    })
    const transition = t.segments.find(s => s.type === 'transition')
    expect(transition).toBeDefined()
    if (transition?.type === 'transition') {
      const keeps = transition.transition.lines.filter(l => l.type === 'keep')
      expect(keeps.some(k => k.line === 'a')).toBe(true)
    }
  })

  test('transition.fromFrameId and toFrameId match the frames', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [
        { id: 'first', code: 'x' },
        { id: 'second', code: 'y' },
      ],
    })
    const transition = t.segments[1]
    expect(transition.type).toBe('transition')
    if (transition.type === 'transition') {
      expect(transition.transition.fromFrameId).toBe('first')
      expect(transition.transition.toFrameId).toBe('second')
    }
  })
})

describe('locateInTimeline: edge cases', () => {
  test('negative elapsed clamps to 0', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [{ id: 'a', code: 'x', hold: 1000 }],
    })
    const pos = locateInTimeline(t, -500)
    expect(pos.segmentIndex).toBe(0)
    expect(pos.segmentProgress).toBe(0)
    expect(pos.elapsedMs).toBe(0)
  })

  test('zero-duration segment produces progress=1', () => {
    const t = buildTimeline({
      language: 'ts',
      frames: [
        { id: 'a', code: 'x', hold: 1000 },
        { id: 'b', code: 'y', transition: { duration: 0 } },
      ],
    })
    const transitionSeg = t.segments.find(s => s.type === 'transition')
    expect(transitionSeg?.durationMs).toBe(0)
  })
})
