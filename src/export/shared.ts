// Rendering helpers shared by the MP4, GIF and PNG export paths, so the
// three can't drift in how they resolve fonts, tokens and dimensions.

import { buildTimeline, collapseTransitions } from '../model/timeline'
import { frameLanguage } from '../model/spec'
import { DEFAULTS, type Spec } from '../model/types'
import { highlight, type TokenLine } from '../render/highlighter'
import {
  DEFAULT_RENDER_OPTIONS,
  heightForFrames,
  type RenderOptions,
} from '../render/canvas'
import { resolveTheme } from '../render/themes'
import type { CommonExportOptions } from './types'

export async function preloadTokens(spec: Spec): Promise<Map<string, TokenLine[]>> {
  const map = new Map<string, TokenLine[]>()
  const shikiTheme = resolveTheme(spec.theme).shikiTheme
  await Promise.all(
    spec.frames.map(async f => {
      try {
        map.set(f.id, await highlight(f.code, frameLanguage(f, spec), shikiTheme))
      } catch {
        map.set(
          f.id,
          f.code.split('\n').map(line => [{ content: line }]),
        )
      }
    }),
  )
  return map
}

// Make sure the code web font (e.g. JetBrains Mono) is actually loaded
// before rendering, so every exported frame uses it instead of the system
// fallback. No-op outside the browser.
export async function ensureFontsReady(opts: RenderOptions): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const primary = opts.fontFamily.split(',')[0].trim()
  try {
    await document.fonts.load(`${opts.fontSize}px ${primary}`)
    await document.fonts.load(`700 ${opts.fontSize}px ${primary}`)
    await document.fonts.ready
  } catch {
    /* fall back to whatever font is available */
  }
}

// Merge DEFAULT + theme + caller render options and resolve the height
// (accounting for chrome etc.). Shared by both export paths so they can't
// drift.
export function buildRenderOpts(
  spec: Spec,
  options: CommonExportOptions,
): RenderOptions {
  const baseOpts: RenderOptions = {
    ...DEFAULT_RENDER_OPTIONS,
    ...resolveTheme(spec.theme).render,
    ...options.render,
  }
  return {
    ...baseOpts,
    height: options.render?.height ?? heightForFrames(spec.frames, baseOpts),
  }
}

export function setupRender(spec: Spec, options: CommonExportOptions) {
  const fps = options.fps ?? DEFAULTS.fps
  const renderOpts = buildRenderOpts(spec, options)
  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline
  return { fps, renderOpts, timeline }
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        reject(new Error('canvas.toBlob returned null'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}
