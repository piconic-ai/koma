import { describe, expect, test } from 'bun:test'
import { heightForFrames, truncateTokenLine } from './canvas'
import type { TokenLine } from './highlighter'

describe('truncateTokenLine', () => {
  const line: TokenLine = [
    { content: 'const', color: '#ff7b72' },
    { content: ' x = ', color: '#c9d1d9' },
    { content: '42', color: '#79c0ff' },
  ]

  test('chars=-1 returns all tokens unchanged', () => {
    expect(truncateTokenLine(line, -1)).toEqual(line)
  })

  test('chars=0 returns empty', () => {
    expect(truncateTokenLine(line, 0)).toEqual([])
  })

  test('truncates mid-token', () => {
    const result = truncateTokenLine(line, 3)
    expect(result).toEqual([
      { content: 'con', color: '#ff7b72' },
    ])
  })

  test('truncates at exact token boundary', () => {
    const result = truncateTokenLine(line, 5)
    expect(result).toEqual([
      { content: 'const', color: '#ff7b72' },
    ])
  })

  test('truncates across tokens', () => {
    const result = truncateTokenLine(line, 8)
    expect(result).toEqual([
      { content: 'const', color: '#ff7b72' },
      { content: ' x ', color: '#c9d1d9' },
    ])
  })

  test('chars >= total length returns all tokens', () => {
    const result = truncateTokenLine(line, 100)
    expect(result).toEqual(line)
  })

  test('handles empty token list', () => {
    expect(truncateTokenLine([], 5)).toEqual([])
  })

  test('handles tokens without color', () => {
    const plain: TokenLine = [{ content: 'hello world' }]
    const result = truncateTokenLine(plain, 5)
    expect(result).toEqual([{ content: 'hello' }])
  })
})

describe('heightForFrames', () => {
  test('single line returns minimum height', () => {
    const h = heightForFrames([{ id: 'a', code: 'x' }])
    expect(h).toBeGreaterThan(0)
  })

  test('more lines produce greater height', () => {
    const h1 = heightForFrames([{ id: 'a', code: 'a' }])
    const h5 = heightForFrames([{ id: 'a', code: 'a\nb\nc\nd\ne' }])
    expect(h5).toBeGreaterThan(h1)
  })

  test('uses max line count across all frames', () => {
    const hShort = heightForFrames([{ id: 'a', code: 'a' }])
    const hMixed = heightForFrames([
      { id: 'a', code: 'a' },
      { id: 'b', code: 'a\nb\nc' },
    ])
    expect(hMixed).toBeGreaterThan(hShort)
  })

  test('respects option overrides', () => {
    const frames = [{ id: 'a', code: 'a\nb' }]
    const h1 = heightForFrames(frames, { fontSize: 28 })
    const h2 = heightForFrames(frames, { fontSize: 14 })
    expect(h1).toBeGreaterThan(h2)
  })

  test('always returns an even height (H.264 mp4 export needs even dims)', () => {
    for (let lines = 1; lines <= 12; lines++) {
      const code = Array.from({ length: lines }, (_, i) => `line${i}`).join('\n')
      expect(heightForFrames([{ id: 'a', code }]) % 2).toBe(0)
    }
  })
})
