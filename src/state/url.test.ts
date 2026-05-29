import { describe, expect, test } from 'bun:test'
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

  test('round-trips frame.hold and frame.transition', () => {
    const spec: Spec = {
      language: 'go',
      frames: [
        { id: 'a', code: 'x', hold: 500, transition: { duration: 200 } },
        { id: 'b', code: 'y' },
      ],
    }
    const decoded = decodeFromHash(encodeToHash(spec))
    expect(decoded!.frames[0].hold).toBe(500)
    expect(decoded!.frames[0].transition).toEqual({ duration: 200 })
    expect(decoded!.frames[1].hold).toBeUndefined()
  })

  test('round-trips all supported languages', () => {
    const languages: Spec['language'][] = [
      'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go',
      'rb', 'pl', 'html', 'css', 'sh', 'json', 'text',
    ]
    for (const lang of languages) {
      const spec: Spec = { language: lang, frames: [{ id: 'x', code: 'test' }] }
      const decoded = decodeFromHash(encodeToHash(spec))
      expect(decoded!.language).toBe(lang)
    }
  })

  test('strips frame ids on encode (not leaked into hash)', () => {
    const hash = encodeToHash(sample)
    const json = atob(hash.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed = JSON.parse(json)
    expect(parsed.frames[0]).not.toHaveProperty('id')
  })

  test('returns null for JSON that lacks frames array', () => {
    const hash = btoa(JSON.stringify({ language: 'ts' }))
    expect(decodeFromHash(hash)).toBeNull()
  })

  test('returns null for JSON that lacks language', () => {
    const hash = btoa(JSON.stringify({ frames: [{ code: 'x' }] }))
    expect(decodeFromHash(hash)).toBeNull()
  })

  test('round-trips a non-default theme', () => {
    const spec: Spec = {
      language: 'ts',
      frames: [{ id: 'a', code: 'x' }],
      theme: 'hono',
    }
    const decoded = decodeFromHash(encodeToHash(spec))
    expect(decoded!.theme).toBe('hono')
  })

  test('omits the default theme from the hash', () => {
    const spec: Spec = {
      language: 'ts',
      frames: [{ id: 'a', code: 'x' }],
      theme: 'piconic',
    }
    const hash = encodeToHash(spec)
    const json = atob(hash.replace(/-/g, '+').replace(/_/g, '/'))
    expect(JSON.parse(json)).not.toHaveProperty('theme')
    // and decode leaves it undefined (consumers fall back to the default)
    expect(decodeFromHash(hash)!.theme).toBeUndefined()
  })

  test('leaves theme undefined when absent', () => {
    const decoded = decodeFromHash(encodeToHash(sample))
    expect(decoded!.theme).toBeUndefined()
  })
})
