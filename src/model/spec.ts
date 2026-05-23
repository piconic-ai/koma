// Pure transformations over a `Spec`. The UI calls these whenever the
// user edits the document — every action returns a new `Spec`, which
// keeps subscribers (URL hash sync, timeline build, preview) trivial
// to wire and unit tests easy to author.

import type { Frame, Language, Spec } from './types'

const newId = (): string => {
  // crypto.randomUUID is available in modern browsers and Node 19+.
  // We keep a small fallback for the rare environment that lacks it
  // (e.g. older test runners) so unit tests stay portable.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `frame-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export const createEmptyFrame = (): Frame => ({
  id: newId(),
  code: '',
})

export const emptySpec = (language: Language = 'ts'): Spec => ({
  language,
  frames: [createEmptyFrame()],
})

export const addFrame = (spec: Spec, afterIndex?: number): Spec => {
  const frames = [...spec.frames]
  const insertAt = afterIndex === undefined ? frames.length : afterIndex + 1
  frames.splice(insertAt, 0, createEmptyFrame())
  return { ...spec, frames }
}

export const removeFrame = (spec: Spec, id: string): Spec => ({
  ...spec,
  frames: spec.frames.filter(f => f.id !== id),
})

export const moveFrame = (
  spec: Spec,
  id: string,
  direction: 'up' | 'down',
): Spec => {
  const index = spec.frames.findIndex(f => f.id === id)
  if (index < 0) return spec
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= spec.frames.length) return spec
  const frames = [...spec.frames]
  ;[frames[index], frames[newIndex]] = [frames[newIndex], frames[index]]
  return { ...spec, frames }
}

export const updateFrame = (
  spec: Spec,
  id: string,
  patch: Partial<Omit<Frame, 'id'>>,
): Spec => ({
  ...spec,
  frames: spec.frames.map(f => (f.id === id ? { ...f, ...patch } : f)),
})

export const duplicateFrame = (spec: Spec, id: string): Spec => {
  const index = spec.frames.findIndex(f => f.id === id)
  if (index < 0) return spec
  const original = spec.frames[index]
  const copy: Frame = { ...original, id: newId() }
  const frames = [...spec.frames]
  frames.splice(index + 1, 0, copy)
  return { ...spec, frames }
}

export const setLanguage = (spec: Spec, language: Language): Spec => ({
  ...spec,
  language,
})
