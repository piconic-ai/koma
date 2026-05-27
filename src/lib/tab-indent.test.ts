import { describe, expect, test } from 'bun:test'
import { applyTabIndent } from './tab-indent'

describe('applyTabIndent', () => {
  test('inserts two spaces at cursor position', () => {
    const result = applyTabIndent('hello', 3, 3)
    expect(result.value).toBe('hel  lo')
    expect(result.cursor).toBe(5)
  })

  test('replaces selected text with indent', () => {
    const result = applyTabIndent('hello', 1, 4)
    expect(result.value).toBe('h  o')
    expect(result.cursor).toBe(3)
  })

  test('inserts at beginning', () => {
    const result = applyTabIndent('hello', 0, 0)
    expect(result.value).toBe('  hello')
    expect(result.cursor).toBe(2)
  })

  test('inserts at end', () => {
    const result = applyTabIndent('hello', 5, 5)
    expect(result.value).toBe('hello  ')
    expect(result.cursor).toBe(7)
  })

  test('supports custom indent string', () => {
    const result = applyTabIndent('ab', 1, 1, '\t')
    expect(result.value).toBe('a\tb')
    expect(result.cursor).toBe(2)
  })
})
