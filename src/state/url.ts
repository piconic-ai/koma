// URL-hash codec for `Spec`. The hash is the source of truth in the
// browser — sharing a koma is just sharing the URL.
//
// Format: base64url-encoded UTF-8 JSON. Frame ids are stripped on
// encode and regenerated on decode (the ids are UI-only).
//
// Compression isn't applied at this scope — a 5-frame / 100-line spec
// is on the order of a kilobyte uncompressed, well under typical
// URL-length limits. If the size becomes a problem we can swap in
// CompressionStream behind this interface.

import type { Frame, Spec } from '../model/types'

type SerializedFrame = Omit<Frame, 'id'>
type SerializedSpec = { language: Spec['language']; frames: SerializedFrame[]; width?: number }

const utf8ToBase64Url = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  // btoa wants a binary string. Building it in one pass keeps the call
  // cheap for the spec sizes we're encoding.
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const base64 = btoa(bin)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const base64UrlToUtf8 = (s: string): string => {
  // Restore standard base64 alphabet and pad to a multiple of 4.
  const pad = s.length % 4
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') +
    (pad === 0 ? '' : '='.repeat(4 - pad))
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `frame-${Math.random().toString(36).slice(2)}`
}

export function encodeToHash(spec: Spec): string {
  let frames = spec.frames.map(({ id: _id, ...rest }) => rest)
  while (frames.length > 1 && !frames[frames.length - 1].code.trim()) {
    frames = frames.slice(0, -1)
  }
  const payload: SerializedSpec = {
    language: spec.language,
    frames,
    ...(spec.width && spec.width !== 1080 ? { width: spec.width } : {}),
  }
  return utf8ToBase64Url(JSON.stringify(payload))
}

export function decodeFromHash(hash: string): Spec | null {
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  try {
    const json = base64UrlToUtf8(trimmed)
    const parsed = JSON.parse(json) as Partial<SerializedSpec>
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.language || !Array.isArray(parsed.frames)) return null
    return {
      language: parsed.language,
      frames: parsed.frames.map(f => ({
        ...f,
        id: newId(),
      })),
      ...(parsed.width ? { width: parsed.width as Spec['width'] } : {}),
    }
  } catch {
    return null
  }
}
