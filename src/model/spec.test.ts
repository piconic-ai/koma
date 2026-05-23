import { describe, expect, test } from 'vitest'
import {
  addFrame,
  createEmptyFrame,
  duplicateFrame,
  emptySpec,
  moveFrame,
  removeFrame,
  setLanguage,
  updateFrame,
} from './spec'

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
