import { describe, expect, test } from 'vitest'
import { decodeFromHash, encodeToHash } from './url'
import type { Spec } from '../model/types'

const sample: Spec = {
  language: 'ts',
  frames: [
    { id: 'a', code: 'const x = 1' },
    { id: 'b', code: 'const x = 1\nconst y = 2', hold: 1500 },
  ],
}

describe('encodeToHash / decodeFromHash', () => {
  test('round-trips language and code', () => {
    const hash = encodeToHash(sample)
    const decoded = decodeFromHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded!.language).toBe('ts')
    expect(decoded!.frames.map(f => f.code)).toEqual(
      sample.frames.map(f => f.code),
    )
    expect(decoded!.frames[1].hold).toBe(1500)
  })

  test('regenerates frame ids on decode', () => {
    const hash = encodeToHash(sample)
    const decoded = decodeFromHash(hash)
    expect(decoded!.frames[0].id).not.toBe('a')
    expect(decoded!.frames[1].id).not.toBe('b')
    expect(decoded!.frames[0].id).not.toBe(decoded!.frames[1].id)
  })

  test('uses URL-safe base64 (no +, /, or =)', () => {
    const hash = encodeToHash(sample)
    expect(hash).not.toMatch(/[+/=]/)
  })

  test('handles unicode (multi-byte) code', () => {
    const spec: Spec = {
      language: 'text',
      frames: [{ id: 'x', code: 'こんにちは, 世界 🎌' }],
    }
    const decoded = decodeFromHash(encodeToHash(spec))
    expect(decoded!.frames[0].code).toBe('こんにちは, 世界 🎌')
  })

  test('returns null on empty hash', () => {
    expect(decodeFromHash('')).toBeNull()
    expect(decodeFromHash('#')).toBeNull()
  })

  test('returns null on malformed input', () => {
    expect(decodeFromHash('#not-base64!')).toBeNull()
    expect(decodeFromHash('#' + btoa('not json'))).toBeNull()
  })

  test('accepts hashes both with and without leading #', () => {
    const hash = encodeToHash(sample)
    expect(decodeFromHash(hash)).not.toBeNull()
    expect(decodeFromHash('#' + hash)).not.toBeNull()
  })
})
