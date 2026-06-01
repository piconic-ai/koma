import { describe, expect, test } from 'bun:test'
import {
  addFrame,
  createEmptyFrame,
  duplicateFrame,
  emptySpec,
  frameLanguage,
  moveFrame,
  removeFrame,
  setLanguage,
  updateFrame,
} from './spec'
import type { Spec } from './types'

describe('emptySpec', () => {
  test('has one empty frame and a default language', () => {
    const spec = emptySpec()
    expect(spec.language).toBe('ts')
    expect(spec.frames).toHaveLength(1)
    expect(spec.frames[0].code).toBe('')
    expect(spec.frames[0].id).toMatch(/.+/)
  })

  test('respects the language argument', () => {
    expect(emptySpec('py').language).toBe('py')
  })
})

describe('createEmptyFrame', () => {
  test('gives each frame a unique id', () => {
    const a = createEmptyFrame()
    const b = createEmptyFrame()
    expect(a.id).not.toBe(b.id)
  })
})

describe('addFrame', () => {
  test('appends when no index given', () => {
    const base = emptySpec()
    const next = addFrame(base)
    expect(next.frames).toHaveLength(2)
    expect(next).not.toBe(base)
  })

  test('inserts after the given index', () => {
    const a = emptySpec()
    const b = addFrame(a)
    const c = addFrame(b, 0)
    expect(c.frames).toHaveLength(3)
    // The new frame should be at position 1, original frame[1] now at position 2.
    expect(c.frames[2].id).toBe(b.frames[1].id)
  })
})

describe('addFrame language inheritance', () => {
  test('a new frame inherits the previous frame’s explicit language', () => {
    const base = emptySpec()
    const id = base.frames[0].id
    const withLang = updateFrame(base, id, { language: 'rs' })
    const next = addFrame(withLang)
    expect(next.frames[1].language).toBe('rs')
  })

  test('an Auto (unset) previous frame leaves the new frame Auto', () => {
    const next = addFrame(emptySpec())
    expect(next.frames[1].language).toBeUndefined()
  })

  test('inherits from the frame the new one is inserted after', () => {
    const spec = emptySpec()
    spec.frames = [
      { ...spec.frames[0], language: 'py' },
      { id: 'x', code: '', language: 'go' },
    ]
    const next = addFrame(spec, 0)
    expect(next.frames[1].language).toBe('py')
  })
})

describe('frameLanguage', () => {
  const spec = (): Spec => ({ language: 'ts', frames: [] })

  test('an explicit per-frame language wins', () => {
    expect(frameLanguage({ id: 'a', code: 'whatever', language: 'rs' }, spec())).toBe('rs')
  })

  test('Auto detects from the code', () => {
    expect(frameLanguage({ id: 'a', code: 'def f():\n    return 1' }, spec())).toBe('py')
  })

  test('Auto falls back to the document language when detection is inconclusive', () => {
    expect(frameLanguage({ id: 'a', code: 'just some prose here' }, spec())).toBe('ts')
  })
})

describe('removeFrame', () => {
  test('removes the matching frame', () => {
    const a = addFrame(emptySpec())
    const target = a.frames[0].id
    const next = removeFrame(a, target)
    expect(next.frames).toHaveLength(1)
    expect(next.frames[0].id).not.toBe(target)
  })

  test('no-op when id unknown', () => {
    const a = emptySpec()
    expect(removeFrame(a, 'unknown').frames).toHaveLength(1)
  })
})

describe('moveFrame', () => {
  test('swaps with the previous frame on up', () => {
    const a = addFrame(emptySpec())
    const [first, second] = a.frames
    const next = moveFrame(a, second.id, 'up')
    expect(next.frames.map(f => f.id)).toEqual([second.id, first.id])
  })

  test('swaps with the next frame on down', () => {
    const a = addFrame(emptySpec())
    const [first, second] = a.frames
    const next = moveFrame(a, first.id, 'down')
    expect(next.frames.map(f => f.id)).toEqual([second.id, first.id])
  })

  test('no-op at the boundaries', () => {
    const a = addFrame(emptySpec())
    expect(moveFrame(a, a.frames[0].id, 'up')).toEqual(a)
    expect(moveFrame(a, a.frames[1].id, 'down')).toEqual(a)
  })
})

describe('updateFrame', () => {
  test('patches code without touching id', () => {
    const a = emptySpec()
    const id = a.frames[0].id
    const next = updateFrame(a, id, { code: 'const x = 1' })
    expect(next.frames[0].id).toBe(id)
    expect(next.frames[0].code).toBe('const x = 1')
  })

  test('clears optional fields when set to undefined', () => {
    const a = emptySpec()
    const id = a.frames[0].id
    const withHold = updateFrame(a, id, { hold: 1500 })
    expect(withHold.frames[0].hold).toBe(1500)
    const cleared = updateFrame(withHold, id, { hold: undefined })
    expect(cleared.frames[0].hold).toBeUndefined()
  })
})

describe('duplicateFrame', () => {
  test('inserts a copy with a fresh id right after the source', () => {
    const a = updateFrame(emptySpec(), emptySpec().frames[0].id, { code: 'x' })
    // re-derive after updateFrame returned a fresh spec
    const base = addFrame(a)
    const sourceId = base.frames[0].id
    const next = duplicateFrame(base, sourceId)
    expect(next.frames).toHaveLength(3)
    expect(next.frames[0].id).toBe(sourceId)
    expect(next.frames[1].id).not.toBe(sourceId)
    expect(next.frames[1].code).toBe(base.frames[0].code)
  })

  test('no-op when id unknown', () => {
    const a = emptySpec()
    expect(duplicateFrame(a, 'unknown')).toEqual(a)
  })
})

describe('setLanguage', () => {
  test('replaces the language without touching frames', () => {
    const a = emptySpec('ts')
    const next = setLanguage(a, 'py')
    expect(next.language).toBe('py')
    expect(next.frames).toBe(a.frames)
  })
})

describe('immutability', () => {
  test('addFrame does not mutate the original spec', () => {
    const original = emptySpec()
    const originalFrameCount = original.frames.length
    addFrame(original)
    expect(original.frames).toHaveLength(originalFrameCount)
  })

  test('removeFrame does not mutate the original spec', () => {
    const original = addFrame(emptySpec())
    const originalFrameCount = original.frames.length
    removeFrame(original, original.frames[0].id)
    expect(original.frames).toHaveLength(originalFrameCount)
  })

  test('updateFrame does not mutate the original frame', () => {
    const original = emptySpec()
    const id = original.frames[0].id
    updateFrame(original, id, { code: 'changed' })
    expect(original.frames[0].code).toBe('')
  })

  test('moveFrame does not mutate the original frames array', () => {
    const original = addFrame(emptySpec())
    const originalOrder = original.frames.map(f => f.id)
    moveFrame(original, original.frames[0].id, 'down')
    expect(original.frames.map(f => f.id)).toEqual(originalOrder)
  })
})

describe('edge cases', () => {
  test('removing all frames results in an empty array', () => {
    const spec = emptySpec()
    const result = removeFrame(spec, spec.frames[0].id)
    expect(result.frames).toHaveLength(0)
  })

  test('duplicateFrame preserves hold and transition overrides', () => {
    const spec = emptySpec()
    const id = spec.frames[0].id
    const withOverrides = updateFrame(spec, id, {
      code: 'test',
      hold: 1500,
      transition: { duration: 200 },
    })
    const duped = duplicateFrame(withOverrides, id)
    expect(duped.frames[1].code).toBe('test')
    expect(duped.frames[1].hold).toBe(1500)
    expect(duped.frames[1].transition).toEqual({ duration: 200 })
    expect(duped.frames[1].id).not.toBe(id)
  })

  test('addFrame at boundary index inserts after that position', () => {
    const base = addFrame(addFrame(emptySpec()))
    const lastId = base.frames[base.frames.length - 1].id
    const result = addFrame(base, base.frames.length - 1)
    expect(result.frames).toHaveLength(4)
    // The new frame is inserted after the last frame
    expect(result.frames[base.frames.length - 1].id).toBe(lastId)
    // The new frame is at the end
    expect(result.frames[result.frames.length - 1].id).not.toBe(lastId)
  })

  test('moveFrame with unknown id is a no-op', () => {
    const spec = emptySpec()
    const result = moveFrame(spec, 'nonexistent', 'up')
    expect(result).toEqual(spec)
  })

  test('updateFrame with unknown id is a no-op', () => {
    const spec = emptySpec()
    const result = updateFrame(spec, 'nonexistent', { code: 'changed' })
    expect(result.frames[0].code).toBe('')
  })
})
