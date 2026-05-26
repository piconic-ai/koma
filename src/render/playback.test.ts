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

  test('modify preserves common prefix during erase phase', () => {
    const role = { type: 'modify' as const, line: 'function greet(name) {', oldLine: 'function greet() {', commonPrefix: 15, fromIndex: 0, toIndex: 0 }
    const at0 = typingForLine(role, 0)
    expect(at0.visible).toBe(true)
    expect(at0.visibleChars).toBe(18)
    expect(at0.displayLine).toBe('function greet() {')

    const atEnd = typingForLine(role, 0.3)
    expect(atEnd.visible).toBe(true)
    expect(atEnd.visibleChars).toBe(15)
  })

  test('modify types new suffix after erase phase', () => {
    const role = { type: 'modify' as const, line: 'function greet(name) {', oldLine: 'function greet() {', commonPrefix: 15, fromIndex: 0, toIndex: 0 }
    const at1 = typingForLine(role, 1)
    expect(at1.visible).toBe(true)
    expect(at1.visibleChars).toBe(22)
    expect(at1.displayLine).toBeUndefined()
  })
})

describe('typingForLine: boundary conditions', () => {
  test('remove at exactly 0.3 becomes invisible', () => {
    const t = typingForLine({ type: 'remove', line: 'hello', fromIndex: 0 }, 0.3)
    expect(t.visible).toBe(false)
  })

  test('add at exactly 0.3 becomes visible (erase phase ends, type phase begins)', () => {
    const t = typingForLine({ type: 'add', line: 'hello', toIndex: 0 }, 0.3)
    expect(t.visible).toBe(true)
    expect(t.visibleChars).toBe(0)
  })

  test('add at just past 0.3 becomes visible with 0 chars', () => {
    const t = typingForLine({ type: 'add', line: 'hello', toIndex: 0 }, 0.301)
    expect(t.visible).toBe(true)
    expect(t.visibleChars).toBe(0)
  })

  test('remove with empty line', () => {
    const t = typingForLine({ type: 'remove', line: '', fromIndex: 0 }, 0.15)
    expect(t.visibleChars).toBe(0)
    expect(t.showCursor).toBe(false)
  })

  test('add with empty line', () => {
    const t = typingForLine({ type: 'add', line: '', toIndex: 0 }, 1)
    expect(t.visibleChars).toBe(0)
    expect(t.showCursor).toBe(false)
  })

  test('keep is always fully visible regardless of progress', () => {
    for (const p of [0, 0.3, 0.5, 1]) {
      const t = typingForLine({ type: 'keep', line: 'x', fromIndex: 0, toIndex: 0 }, p)
      expect(t.visibleChars).toBe(-1)
      expect(t.visible).toBe(true)
      expect(t.showCursor).toBe(false)
    }
  })

  test('modify at exactly the erase-type boundary (0.3)', () => {
    const role = { type: 'modify' as const, line: 'ab_new', oldLine: 'ab_old', commonPrefix: 2, fromIndex: 0, toIndex: 0 }
    const t = typingForLine(role, 0.3)
    expect(t.visibleChars).toBe(2)
    expect(t.visible).toBe(true)
  })

  test('modify with identical prefix and no suffix change', () => {
    const role = { type: 'modify' as const, line: 'abc', oldLine: 'abx', commonPrefix: 2, fromIndex: 0, toIndex: 0 }
    const t = typingForLine(role, 1)
    expect(t.visibleChars).toBe(3)
    expect(t.showCursor).toBe(false)
  })
})

describe('getStageState: empty timeline', () => {
  test('returns defensive hold for empty segments', () => {
    const emptyTimeline = { segments: [], totalDurationMs: 0 }
    const state = getStageState(emptyTimeline, 0)
    expect(state.kind).toBe('hold')
    if (state.kind === 'hold') {
      expect(state.frame.code).toBe('')
    }
  })
})
