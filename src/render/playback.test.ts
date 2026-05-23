import { describe, expect, test } from 'vitest'
import { buildTimeline } from '../model/timeline'
import { DEFAULTS, type Spec } from '../model/types'
import { getStageState, styleForLine } from './playback'

const spec: Spec = {
  language: 'ts',
  frames: [
    { id: 'a', code: 'a', hold: 1000 },
    { id: 'b', code: 'a\nb' },
  ],
}

describe('getStageState', () => {
  test('returns hold for t=0', () => {
    const t = buildTimeline(spec)
    const s = getStageState(t, 0)
    expect(s.kind).toBe('hold')
  })

  test('returns transition mid-segment', () => {
    const t = buildTimeline(spec)
    const s = getStageState(t, 1000 + DEFAULTS.transitionMs / 2)
    expect(s.kind).toBe('transition')
    if (s.kind === 'transition') {
      expect(s.progress).toBeCloseTo(0.5, 2)
      expect(s.lines.length).toBeGreaterThan(0)
    }
  })

  test('returns hold for the final frame past the end', () => {
    const t = buildTimeline(spec)
    const s = getStageState(t, t.totalDurationMs + 9999)
    expect(s.kind).toBe('hold')
    if (s.kind === 'hold') {
      expect(s.frame.id).toBe('b')
    }
  })
})

describe('styleForLine', () => {
  test('keep is always fully visible and not translated', () => {
    expect(
      styleForLine({ type: 'keep', line: 'x', fromIndex: 0, toIndex: 0 }, 0.3),
    ).toEqual({ opacity: 1, translateY: 0 })
  })

  test('add interpolates from 0 to full visibility', () => {
    const at0 = styleForLine({ type: 'add', line: 'x', toIndex: 0 }, 0)
    const at1 = styleForLine({ type: 'add', line: 'x', toIndex: 0 }, 1)
    expect(at0.opacity).toBe(0)
    expect(at0.translateY).toBeGreaterThan(0)
    expect(at1.opacity).toBe(1)
    expect(at1.translateY).toBe(0)
  })

  test('remove fades out and slides up', () => {
    const at0 = styleForLine({ type: 'remove', line: 'x', fromIndex: 0 }, 0)
    const at1 = styleForLine({ type: 'remove', line: 'x', fromIndex: 0 }, 1)
    expect(at0.opacity).toBe(1)
    expect(at0.translateY).toBeCloseTo(0, 6)
    expect(at1.opacity).toBe(0)
    expect(at1.translateY).toBeLessThan(0)
  })
})
