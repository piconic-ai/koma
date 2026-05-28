// Core data model for koma.
//
// A `Spec` describes the whole video: a single language and an ordered
// list of `Frame`s. Each `Frame` is a complete code state — transitions
// between frames are derived later (see `src/model/diff.ts`) and
// assembled into a `Timeline` for playback / export.

export type Language =
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'py'
  | 'rs'
  | 'go'
  | 'rb'
  | 'pl'
  | 'html'
  | 'css'
  | 'sh'
  | 'json'
  | 'text'

export type Frame = {
  /** Internal identity for UI reordering / deletion. Not persisted. */
  id: string
  /** Code block content (newlines included). */
  code: string
  /** Optional override for the display duration in ms. */
  hold?: number
  /** Optional override for the transition *into* this frame. */
  transition?: {
    duration?: number
  }
}

export type CanvasWidth = number

export type Spec = {
  language: Language
  frames: Frame[]
  width?: CanvasWidth
}

export type LineRole =
  | { type: 'keep'; line: string; fromIndex: number; toIndex: number }
  | { type: 'add'; line: string; toIndex: number }
  | { type: 'remove'; line: string; fromIndex: number }
  | { type: 'modify'; line: string; oldLine: string; commonPrefix: number; fromIndex: number; toIndex: number }

export type Transition = {
  fromFrameId: string
  toFrameId: string
  lines: LineRole[]
  durationMs: number
}

export type TimelineSegment =
  | { type: 'hold'; durationMs: number; frame: Frame }
  | { type: 'transition'; durationMs: number; transition: Transition }

export type Timeline = {
  segments: TimelineSegment[]
  totalDurationMs: number
}

export type Defaults = {
  holdPerLineMs: number
  minHoldMs: number
  transitionMs: number
  finalFrameMinHoldMs: number
  fps: number
  width: number
  height: number
  bitrate: number
  fontFamily: string
  fontSize: number
  lineHeight: number
  theme: string
  showWindowChrome: boolean
  padding: number
}

// Single timing model shared by the interactive preview, the timeline
// bar, and the video export — so what you see while editing is exactly
// what you download. (Preview and export used to diverge: the preview
// ran fast while the export padded holds, which made downloaded videos
// run ~3x longer than the on-screen preview.)
export const DEFAULTS: Defaults = {
  holdPerLineMs: 140,
  minHoldMs: 700,
  transitionMs: 400,
  finalFrameMinHoldMs: 0,
  fps: 30,
  width: 1080,
  height: 1080,
  bitrate: 2_000_000,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 18,
  lineHeight: 1.6,
  theme: 'github-dark',
  showWindowChrome: true,
  padding: 32,
}
