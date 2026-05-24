import { describe, expect, test } from 'vitest'
import { buildTimeline } from '../model/timeline'
import { DEFAULTS, type Spec } from '../model/types'
import { getStageState, typingForLine } from './playback'

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

describe('typingForLine', () => {
  test('keep shows all characters', () => {
    const t = typingForLine({ type: 'keep', line: 'hello', fromIndex: 0, toIndex: 0 }, 0.5)
    expect(t.visibleChars).toBe(-1)
    expect(t.visible).toBe(true)
  })

  test('remove erases characters in the first 30%', () => {
    const at0 = typingForLine({ type: 'remove', line: 'hello', fromIndex: 0 }, 0)
    expect(at0.visibleChars).toBe(5)
    expect(at0.visible).toBe(true)
    const atEnd = typingForLine({ type: 'remove', line: 'hello', fromIndex: 0 }, 0.3)
    expect(atEnd.visible).toBe(false)
  })

  test('add types characters after 30%', () => {
    const early = typingForLine({ type: 'add', line: 'hello', toIndex: 0 }, 0.1)
    expect(early.visible).toBe(false)
    const at1 = typingForLine({ type: 'add', line: 'hello', toIndex: 0 }, 1)
    expect(at1.visibleChars).toBe(5)
    expect(at1.visible).toBe(true)
  })
})
