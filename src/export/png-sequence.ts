// PNG sequence export — iterates the timeline at a target fps,
// rasterises each tick via the canvas renderer, and packs the
// resulting PNGs into a stored ZIP.
//
// The whole pipeline runs in the browser; no server roundtrip.

import { buildTimeline, collapseTransitions } from '../model/timeline'
import { DEFAULTS, type Spec } from '../model/types'
import { highlight, type TokenLine } from '../render/highlighter'
import {
  DEFAULT_RENDER_OPTIONS,
  renderToCanvas,
  type RenderOptions,
} from './canvas-render'
import { ZipWriter } from './zip'

export type PngSequenceOptions = {
  fps?: number
  reduceMotion?: boolean
  render?: Partial<RenderOptions>
}

export type PngProgress = {
  current: number
  total: number
}

async function preloadTokens(spec: Spec): Promise<Map<string, TokenLine[]>> {
  const map = new Map<string, TokenLine[]>()
  await Promise.all(
    spec.frames.map(async f => {
      try {
        map.set(f.id, await highlight(f.code, spec.language))
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

function canvasToPngBytes(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array> {
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

export async function exportPngSequence(
  spec: Spec,
  onProgress?: (p: PngProgress) => void,
  options: PngSequenceOptions = {},
): Promise<Blob> {
  const fps = options.fps ?? DEFAULTS.fps
  const dt = 1000 / fps

  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline

  const tokensByFrame = await preloadTokens(spec)

  const renderOpts: RenderOptions = {
    ...DEFAULT_RENDER_OPTIONS,
    ...options.render,
  }
  const canvas = document.createElement('canvas')
  canvas.width = renderOpts.width
  canvas.height = renderOpts.height

  const total = Math.max(1, Math.ceil(timeline.totalDurationMs / dt))
  const zip = new ZipWriter()
  const pad = String(total).length

  for (let i = 0; i < total; i++) {
    renderToCanvas(canvas, {
      timeline,
      elapsedMs: i * dt,
      tokensByFrame,
      frames: spec.frames,
      options: renderOpts,
    })
    const bytes = await canvasToPngBytes(canvas)
    zip.add(`frame_${String(i + 1).padStart(pad, '0')}.png`, bytes)
    onProgress?.({ current: i + 1, total })
  }

  return zip.finalize()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click is in-flight; the navigation will already
  // have started by the next microtask.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
