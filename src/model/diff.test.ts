import { describe, expect, test } from 'vitest'
import { computeLineRoles } from './diff'
import type { Frame } from './types'

const frame = (code: string): Frame => ({ id: 'x', code })

describe('computeLineRoles', () => {
  test('identical frames keep every line', () => {
    const a = frame('a\nb\nc')
    const roles = computeLineRoles(a, a)
    expect(roles.every(r => r.type === 'keep')).toBe(true)
    expect(roles).toHaveLength(3)
  })

  test('appended lines are marked add', () => {
    const a = frame('a\nb')
    const b = frame('a\nb\nc')
    const roles = computeLineRoles(a, b)
    expect(roles).toEqual([
      { type: 'keep', line: 'a', fromIndex: 0, toIndex: 0 },
      { type: 'keep', line: 'b', fromIndex: 1, toIndex: 1 },
      { type: 'add', line: 'c', toIndex: 2 },
    ])
  })

  test('deleted lines are marked remove', () => {
    const a = frame('a\nb\nc')
    const b = frame('a\nc')
    const roles = computeLineRoles(a, b)
    expect(roles).toEqual([
      { type: 'keep', line: 'a', fromIndex: 0, toIndex: 0 },
      { type: 'remove', line: 'b', fromIndex: 1 },
      { type: 'keep', line: 'c', fromIndex: 2, toIndex: 1 },
    ])
  })

  test('replacement shows up as remove + add', () => {
    const a = frame('a\nb\nc')
    const b = frame('a\nB\nc')
    const roles = computeLineRoles(a, b)
    // The exact ordering depends on the diff library — assert the
    // composition rather than the precise order.
    const removed = roles.filter(r => r.type === 'remove')
    const added = roles.filter(r => r.type === 'add')
    const kept = roles.filter(r => r.type === 'keep').map(r => r.line)
    expect(removed.map(r => r.line)).toEqual(['b'])
    expect(added.map(r => r.line)).toEqual(['B'])
    expect(kept).toEqual(['a', 'c'])
  })

  test('handles full replacement', () => {
    const a = frame('a\nb')
    const b = frame('x\ny')
    const roles = computeLineRoles(a, b)
    const added = roles.filter(r => r.type === 'add').map(r => r.line)
    const removed = roles.filter(r => r.type === 'remove').map(r => r.line)
    expect(added).toEqual(['x', 'y'])
    expect(removed).toEqual(['a', 'b'])
  })

  test('empty -> non-empty marks the new lines as add', () => {
    const a = frame('')
    const b = frame('a\nb')
    const roles = computeLineRoles(a, b)
    const added = roles.filter(r => r.type === 'add').map(r => r.line)
    const removed = roles.filter(r => r.type === 'remove').map(r => r.line)
    // The empty frame splits into a single empty line, which diffs as a
    // removal because '' is not in ['a', 'b'].
    expect(added).toEqual(['a', 'b'])
    expect(removed).toEqual([''])
  })

  test('indices reference original line positions', () => {
    const a = frame('a\nb\nc\nd')
    const b = frame('a\nc\nd\ne')
    const roles = computeLineRoles(a, b)
    const keepC = roles.find(r => r.type === 'keep' && r.line === 'c')
    expect(keepC).toEqual({
      type: 'keep',
      line: 'c',
      fromIndex: 2,
      toIndex: 1,
    })
  })
})
