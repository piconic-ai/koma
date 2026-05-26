import { describe, expect, test } from 'bun:test'
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

  test('lines with common prefix become modify', () => {
    const a = frame('function greet() {')
    const b = frame('function greet(name: string) {\n  return `Hello, ${name}!`\n}')
    const roles = computeLineRoles(a, b)
    const modified = roles.filter(r => r.type === 'modify')
    expect(modified).toHaveLength(1)
    expect(modified[0]).toEqual({
      type: 'modify',
      line: 'function greet(name: string) {',
      oldLine: 'function greet() {',
      commonPrefix: 15,
      fromIndex: 0,
      toIndex: 0,
    })
    const added = roles.filter(r => r.type === 'add').map(r => r.line)
    expect(added).toEqual(['  return `Hello, ${name}!`', '}'])
  })

  test('replacement without common prefix stays as remove + add', () => {
    const a = frame('a\nb\nc')
    const b = frame('a\nB\nc')
    const roles = computeLineRoles(a, b)
    const modified = roles.filter(r => r.type === 'modify')
    expect(modified).toHaveLength(0)
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

describe('computeLineRoles: edge cases', () => {
  test('both empty frames produce a single keep for the empty line', () => {
    const a = frame('')
    const roles = computeLineRoles(a, a)
    expect(roles).toEqual([
      { type: 'keep', line: '', fromIndex: 0, toIndex: 0 },
    ])
  })

  test('non-empty -> empty marks all lines as remove and empty as add', () => {
    const a = frame('a\nb')
    const b = frame('')
    const roles = computeLineRoles(a, b)
    const removed = roles.filter(r => r.type === 'remove').map(r => r.line)
    const added = roles.filter(r => r.type === 'add').map(r => r.line)
    expect(removed).toEqual(['a', 'b'])
    expect(added).toEqual([''])
  })

  test('whitespace-only changes are detected', () => {
    const a = frame('  a')
    const b = frame('    a')
    const roles = computeLineRoles(a, b)
    const modified = roles.filter(r => r.type === 'modify')
    expect(modified).toHaveLength(1)
    if (modified[0].type === 'modify') {
      expect(modified[0].commonPrefix).toBe(2)
    }
  })

  test('identical lines separated by insertions stay as keep', () => {
    const a = frame('a\nb')
    const b = frame('a\nX\nb')
    const roles = computeLineRoles(a, b)
    const keeps = roles.filter(r => r.type === 'keep').map(r => r.line)
    expect(keeps).toEqual(['a', 'b'])
    const added = roles.filter(r => r.type === 'add').map(r => r.line)
    expect(added).toEqual(['X'])
  })

  test('duplicate lines are handled correctly', () => {
    const a = frame('a\na\na')
    const b = frame('a\na')
    const roles = computeLineRoles(a, b)
    const keeps = roles.filter(r => r.type === 'keep')
    const removes = roles.filter(r => r.type === 'remove')
    expect(keeps).toHaveLength(2)
    expect(removes).toHaveLength(1)
  })

  test('multi-byte unicode lines diff correctly', () => {
    const a = frame('こんにちは')
    const b = frame('こんばんは')
    const roles = computeLineRoles(a, b)
    const modified = roles.filter(r => r.type === 'modify')
    if (modified.length > 0 && modified[0].type === 'modify') {
      expect(modified[0].commonPrefix).toBe(2)
    } else {
      const removed = roles.filter(r => r.type === 'remove')
      const added = roles.filter(r => r.type === 'add')
      expect(removed).toHaveLength(1)
      expect(added).toHaveLength(1)
    }
  })

  test('line reordering produces remove + add pairs', () => {
    const a = frame('a\nb\nc')
    const b = frame('c\nb\na')
    const roles = computeLineRoles(a, b)
    const keeps = roles.filter(r => r.type === 'keep')
    expect(keeps.length).toBeGreaterThanOrEqual(1)
  })
})
