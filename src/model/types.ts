// Core data model for koma.
//
// A `Spec` describes the whole video: an ordered list of `Frame`s plus a
// document-level fallback language. Each `Frame` is a complete code state
// and may carry its own language (Auto-detected when unset) — transitions
// between frames are derived later (see `src/model/diff.ts`) and
// assembled into a `Timeline` for playback / export.

export type Language =
  | 'c'
  | 'cs'
  | 'cpp'
  | 'css'
  | 'dart'
  | 'ex'
  | 'fs'
  | 'go'
  | 'hs'
  | 'html'
  | 'java'
  | 'js'
  | 'json'
  | 'jsx'
  | 'kt'
  | 'md'
  | 'pl'
  | 'php'
  | 'text'
  | 'py'
  | 'rb'
  | 'rs'
  | 'scala'
  | 'sh'
  | 'tsx'
  | 'ts'
  | 'vue'

export type Frame = {
  /** Internal identity for UI reordering / deletion. Not persisted. */
  id: string
  /** Code block content (newlines included). */
  code: string
  /** Per-frame syntax language. Undefined means "Auto" — the language is
   *  detected from the code (see `frameLanguage`). Set explicitly by typing a
   *  markdown fence (e.g. ```ts) at the top of the frame. */
  language?: Language
  /** Optional override for the display duration in ms. */
  hold?: number
  /** Optional override for the transition *into* this frame. */
  transition?: {
    duration?: number
  }
}

export type CanvasWidth = number

// Visual preset for the rendered video (outer background, window chrome,
// accent colors). The syntax highlight theme is shared across all presets.
// The registry of presets lives in `src/render/themes.ts`; this id is the
// only piece persisted in the `Spec`. Undefined means the default preset.
export type ThemeId = 'piconic' | 'barefoot' | 'hono' | 'p2bhaus'

export type Spec = {
  /** Document-level fallback language, used when a frame is Auto and the code
   *  can't be detected. Per-frame `Frame.language` takes precedence. */
  language: Language
  frames: Frame[]
  width?: CanvasWidth
  theme?: ThemeId
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
  minTransitionMs: number
  maxTransitionMs: number
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
  minTransitionMs: 100,
  maxTransitionMs: 2000,
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
