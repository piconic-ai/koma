import { describe, expect, test } from 'bun:test'
import { plainTokens } from './highlighter'

describe('plainTokens', () => {
  test('splits code into one token per line', () => {
    const result = plainTokens('a\nb\nc')
    expect(result).toEqual([
      [{ content: 'a' }],
      [{ content: 'b' }],
      [{ content: 'c' }],
    ])
  })

  test('single line returns one-element array', () => {
    expect(plainTokens('hello')).toEqual([[{ content: 'hello' }]])
  })

  test('empty string returns single empty-content token', () => {
    expect(plainTokens('')).toEqual([[{ content: '' }]])
  })

  test('trailing newline produces an extra empty line', () => {
    const result = plainTokens('a\n')
    expect(result).toEqual([
      [{ content: 'a' }],
      [{ content: '' }],
    ])
  })

  test('preserves whitespace within lines', () => {
    const result = plainTokens('  indented\n\ttabbed')
    expect(result).toEqual([
      [{ content: '  indented' }],
      [{ content: '\ttabbed' }],
    ])
  })
})
