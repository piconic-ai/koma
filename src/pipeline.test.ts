import { describe, expect, test } from 'vitest'
import type { Spec } from './model/types'
import { DEFAULTS } from './model/types'
import { buildTimeline, locateInTimeline } from './model/timeline'
import { getStageState, typingForLine } from './render/playback'

// End-to-end pipeline: Spec -> Timeline -> StageState -> TypingState.
// These tests verify that the modules compose correctly — each layer
// feeds its output to the next, producing the rendering data the
// canvas/player consumes.

const twoFrameSpec: Spec = {
  language: 'ts',
  frames: [
    { id: 'f1', code: 'const x = 1', hold: 1000 },
    { id: 'f2', code: 'const x = 1\nconst y = 2' },
  ],
}

describe('pipeline: Spec -> Timeline -> StageState', () => {
  test('t=0 shows the first frame as a hold', () => {
    const timeline = buildTimeline(twoFrameSpec)
    const state = getStageState(timeline, 0)
    expect(state.kind).toBe('hold')
    if (state.kind === 'hold') {
      expect(state.frame.code).toBe('const x = 1')
    }
  })

  test('during transition, all diff lines have typing data', () => {
    const timeline = buildTimeline(twoFrameSpec)
    const midTransition = 1000 + DEFAULTS.transitionMs / 2
    const state = getStageState(timeline, midTransition)
    expect(state.kind).toBe('transition')
    if (state.kind === 'transition') {
      expect(state.lines.length).toBeGreaterThan(0)
      for (const role of state.lines) {
        const typing = typingForLine(role, state.progress)
        expect(typing).toBeDefined()
        expect(typeof typing.visibleChars).toBe('number')
        expect(typeof typing.visible).toBe('boolean')
      }
    }
  })

  test('after transition, shows the second frame as a hold', () => {
    const timeline = buildTimeline(twoFrameSpec)
    const afterTransition = 1000 + DEFAULTS.transitionMs + 1
    const state = getStageState(timeline, afterTransition)
    expect(state.kind).toBe('hold')
    if (state.kind === 'hold') {
      expect(state.frame.code).toBe('const x = 1\nconst y = 2')
    }
  })

  test('past the end, holds on the last frame', () => {
    const timeline = buildTimeline(twoFrameSpec)
    const state = getStageState(timeline, timeline.totalDurationMs + 9999)
    expect(state.kind).toBe('hold')
    if (state.kind === 'hold') {
      expect(state.frame.id).toBe('f2')
    }
  })
})

describe('pipeline: three-frame function evolution', () => {
  const spec: Spec = {
    language: 'ts',
    frames: [
      { id: 'v1', code: 'function greet() {\n  return "hello"\n}', hold: 1000 },
      { id: 'v2', code: 'function greet(name: string) {\n  return `Hello, ${name}!`\n}', hold: 1000 },
      { id: 'v3', code: 'function greet(name: string) {\n  if (!name) throw new Error("name required")\n  return `Hello, ${name}!`\n}' },
    ],
  }

  test('timeline has 5 segments (3 holds + 2 transitions)', () => {
    const timeline = buildTimeline(spec)
    expect(timeline.segments).toHaveLength(5)
    expect(timeline.segments.map(s => s.type)).toEqual([
      'hold', 'transition', 'hold', 'transition', 'hold',
    ])
  })

  test('transition v1->v2 includes a modify for the function signature', () => {
    const timeline = buildTimeline(spec)
    const state = getStageState(timeline, 1000 + DEFAULTS.transitionMs / 2)
    expect(state.kind).toBe('transition')
    if (state.kind === 'transition') {
      const modify = state.lines.find(r => r.type === 'modify')
      expect(modify).toBeDefined()
      if (modify?.type === 'modify') {
        expect(modify.oldLine).toBe('function greet() {')
        expect(modify.line).toBe('function greet(name: string) {')
        expect(modify.commonPrefix).toBe(15)
      }
    }
  })

  test('transition v2->v3 includes an add for the guard clause', () => {
    const timeline = buildTimeline(spec)
    const v2Start = 1000 + DEFAULTS.transitionMs + 1000
    const state = getStageState(timeline, v2Start + DEFAULTS.transitionMs / 2)
    expect(state.kind).toBe('transition')
    if (state.kind === 'transition') {
      const added = state.lines.filter(r => r.type === 'add')
      expect(added.some(r => r.line.includes('throw new Error'))).toBe(true)
    }
  })

  test('typing at progress=0 keeps lines visible, add lines hidden', () => {
    const timeline = buildTimeline(spec)
    const state = getStageState(timeline, 1000) // start of transition
    expect(state.kind).toBe('transition')
    if (state.kind === 'transition') {
      for (const role of state.lines) {
        const typing = typingForLine(role, 0)
        if (role.type === 'keep') {
          expect(typing.visible).toBe(true)
          expect(typing.visibleChars).toBe(-1)
        }
        if (role.type === 'add') {
          expect(typing.visible).toBe(false)
        }
        if (role.type === 'remove') {
          expect(typing.visible).toBe(true)
        }
      }
    }
  })

  test('typing at progress=1 keeps and add lines visible, remove lines hidden', () => {
    const timeline = buildTimeline(spec)
    const state = getStageState(timeline, 1000)
    expect(state.kind).toBe('transition')
    if (state.kind === 'transition') {
      for (const role of state.lines) {
        const typing = typingForLine(role, 1)
        if (role.type === 'keep') {
          expect(typing.visible).toBe(true)
        }
        if (role.type === 'add') {
          expect(typing.visible).toBe(true)
          expect(typing.visibleChars).toBe(role.line.length)
        }
        if (role.type === 'remove') {
          expect(typing.visible).toBe(false)
        }
      }
    }
  })
})

describe('pipeline: single frame spec', () => {
  const spec: Spec = {
    language: 'py',
    frames: [{ id: 'only', code: 'print("hello")' }],
  }

  test('produces a single hold segment, no transitions', () => {
    const timeline = buildTimeline(spec)
    expect(timeline.segments).toHaveLength(1)
    expect(timeline.segments[0].type).toBe('hold')
  })

  test('any elapsed time returns a hold on the only frame', () => {
    const timeline = buildTimeline(spec)
    for (const t of [0, 500, 1000, 99999]) {
      const state = getStageState(timeline, t)
      expect(state.kind).toBe('hold')
      if (state.kind === 'hold') {
        expect(state.frame.code).toBe('print("hello")')
      }
    }
  })
})

describe('pipeline: locateInTimeline segment boundaries', () => {
  const spec: Spec = {
    language: 'ts',
    frames: [
      { id: 'a', code: 'a', hold: 1000 },
      { id: 'b', code: 'b', hold: 1000 },
    ],
  }

  test('exact boundary belongs to the next segment', () => {
    const timeline = buildTimeline(spec)
    const pos = locateInTimeline(timeline, 1000)
    expect(pos.segmentIndex).toBe(1)
    expect(timeline.segments[1].type).toBe('transition')
  })

  test('1ms before boundary stays in current segment', () => {
    const timeline = buildTimeline(spec)
    const pos = locateInTimeline(timeline, 999)
    expect(pos.segmentIndex).toBe(0)
    expect(timeline.segments[0].type).toBe('hold')
  })
})
