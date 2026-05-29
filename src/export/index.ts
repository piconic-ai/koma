// Pre-bundled export entrypoint.
//
// This file is pre-bundled by `scripts/build-export-bundle.mjs` and
// served as `/components/koma-export.js`. AppHeader dynamically imports
// the bundle the first time the user clicks Export, so the heavy export
// pipeline (canvas rendering, zip writer, lazily-fetched mp4-muxer and
// shiki) stays out of the eagerly-loaded component bundles.
//
// This also sidestepped bf's transitive inliner dup-identifier bug
// (piconic-ai/barefootjs#1542, fixed in bf 0.4.0). Even with that fix,
// keep the pre-bundle: a static import would inline the whole pipeline
// into AppHeader and load it on every page visit, not on demand.

import { buildTimeline, collapseTransitions } from '../model/timeline'
import { DEFAULTS, type Spec } from '../model/types'
import { highlight, type TokenLine } from '../render/highlighter'
import {
  DEFAULT_RENDER_OPTIONS,
  heightForFrames,
  renderToCanvas,
  type RenderOptions,
} from '../render/canvas'
import { resolveTheme } from '../render/themes'
import { ZipWriter } from './zip'

export type ExportProgress = {
  current: number
  total: number
}

export type CommonExportOptions = {
  fps?: number
  reduceMotion?: boolean
  render?: Partial<RenderOptions>
}

export type Mp4ExportOptions = CommonExportOptions & {
  bitrate?: number
}

async function preloadTokens(spec: Spec): Promise<Map<string, TokenLine[]>> {
  const map = new Map<string, TokenLine[]>()
  const shikiTheme = resolveTheme(spec.theme).shikiTheme
  await Promise.all(
    spec.frames.map(async f => {
      try {
        map.set(f.id, await highlight(f.code, spec.language, shikiTheme))
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
async function ensureFontsReady(opts: RenderOptions): Promise<void> {
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
function buildRenderOpts(spec: Spec, options: CommonExportOptions): RenderOptions {
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

function setupRender(spec: Spec, options: CommonExportOptions) {
  const fps = options.fps ?? DEFAULTS.fps
  const renderOpts = buildRenderOpts(spec, options)
  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline
  return { fps, renderOpts, timeline }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
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

// ── MP4 (internal) ───────────────────────────────────────────────

function isMp4ExportSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoEncoder === 'function' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoFrame === 'function'
  )
}

type MuxerModule = {
  Muxer: new (opts: unknown) => {
    addVideoChunk: (chunk: unknown, meta?: unknown) => void
    finalize: () => void
    target: { buffer: ArrayBuffer }
  }
  ArrayBufferTarget: new () => { buffer: ArrayBuffer }
}

async function loadMuxer(): Promise<MuxerModule> {
  const url = 'https://esm.sh/mp4-muxer@5.2.2'
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- URL import resolved at runtime by the browser
  const mod = await import(/* @vite-ignore */ url)
  return mod as MuxerModule
}

async function exportMp4(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: Mp4ExportOptions = {},
): Promise<Blob> {
  if (!isMp4ExportSupported()) {
    throw new Error(
      'WebCodecs VideoEncoder is not available in this browser. ' +
        'Use the PNG export and convert offline (e.g. with ffmpeg).',
    )
  }

  const { fps, renderOpts, timeline } = setupRender(spec, options)
  const bitrate = options.bitrate ?? DEFAULTS.bitrate
  const tokensByFrame = await preloadTokens(spec)
  await ensureFontsReady(renderOpts)

  const { Muxer, ArrayBufferTarget } = await loadMuxer()
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: renderOpts.width,
      height: renderOpts.height,
      frameRate: fps,
    },
    fastStart: 'in-memory',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoEncoderRef = (window as any).VideoEncoder as {
    new (init: {
      output: (chunk: unknown, meta?: unknown) => void
      error: (e: Error) => void
    }): {
      state: string
      configure: (cfg: Record<string, unknown>) => void
      encode: (frame: unknown, opts?: { keyFrame?: boolean }) => void
      flush: () => Promise<void>
      close: () => void
    }
    isConfigSupported: (cfg: Record<string, unknown>) => Promise<{
      supported: boolean
      config?: Record<string, unknown>
    }>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoFrameRef = (window as any).VideoFrame as new (
    source: HTMLCanvasElement | OffscreenCanvas,
    init: { timestamp: number; duration?: number },
  ) => { close: () => void }

  // Pick the first H.264 profile the browser accepts. Levels are
  // ordered low → high so we land on the leanest one that fits the
  // requested resolution / frame rate.
  const codecCandidates = [
    'avc1.42E01E', // Baseline 3.0
    'avc1.42E028', // Baseline 4.0 (≥ 1080p)
    'avc1.4D4028', // Main 4.0
    'avc1.640028', // High 4.0
  ]
  let codec: string | null = null
  for (const candidate of codecCandidates) {
    const support = await VideoEncoderRef.isConfigSupported({
      codec: candidate,
      width: renderOpts.width,
      height: renderOpts.height,
      bitrate,
      framerate: fps,
    })
    if (support.supported) {
      codec = candidate
      break
    }
  }
  if (!codec) {
    throw new Error(
      `No supported H.264 profile for ${renderOpts.width}x${renderOpts.height} @ ${fps}fps`,
    )
  }

  const encoderErrors: Error[] = []
  const encoder = new VideoEncoderRef({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => encoderErrors.push(e),
  })
  encoder.configure({
    codec,
    width: renderOpts.width,
    height: renderOpts.height,
    bitrate,
    framerate: fps,
  })

  const canvas = document.createElement('canvas')
  canvas.width = renderOpts.width
  canvas.height = renderOpts.height

  const dt = 1000 / fps
  const total = Math.max(1, Math.ceil(timeline.totalDurationMs / dt))
  const microsecPerFrame = Math.round(1_000_000 / fps)

  for (let i = 0; i < total; i++) {
    renderToCanvas(canvas, {
      timeline,
      elapsedMs: i * dt,
      tokensByFrame,
      frames: spec.frames,
      options: renderOpts,
    })
    const videoFrame = new VideoFrameRef(canvas, {
      timestamp: i * microsecPerFrame,
      duration: microsecPerFrame,
    })
    if (encoder.state === 'closed') {
      videoFrame.close()
      break
    }
    encoder.encode(videoFrame, { keyFrame: i % fps === 0 })
    videoFrame.close()
    onProgress?.({ current: i + 1, total })

    if (i % 30 === 29) await new Promise(r => setTimeout(r, 0))
  }
  if (encoderErrors.length > 0) {
    encoder.close()
    throw encoderErrors[0]
  }

  await encoder.flush()
  encoder.close()
  muxer.finalize()

  if (encoderErrors.length > 0) throw encoderErrors[0]

  return new Blob([target.buffer], { type: 'video/mp4' })
}

// ── Combined export (MP4 + PNGs in one zip) ──────────────────────

export async function exportAll(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: Mp4ExportOptions = {},
): Promise<Blob> {
  const renderOpts = buildRenderOpts(spec, options)
  const tokensByFrame = await preloadTokens(spec)
  await ensureFontsReady(renderOpts)
  // PNG frames use the full (non-reduced-motion) timeline; only the embedded
  // MP4 (via setupRender) collapses transitions.
  const timeline = buildTimeline(spec)
  const canvas = document.createElement('canvas')
  canvas.width = renderOpts.width
  canvas.height = renderOpts.height

  const zip = new ZipWriter()
  const total = spec.frames.length
  const pad = String(total).length

  // 1) Render per-frame PNGs
  let elapsed = 0
  for (let i = 0; i < total; i++) {
    renderToCanvas(canvas, {
      timeline,
      elapsedMs: elapsed,
      tokensByFrame,
      frames: spec.frames,
      options: renderOpts,
    })
    const bytes = await canvasToPngBytes(canvas)
    zip.add(`frame_${String(i + 1).padStart(pad, '0')}.png`, bytes)
    onProgress?.({ current: i + 1, total: total + 1 })
    const holdSeg = timeline.segments[i * 2]
    const transSeg = timeline.segments[i * 2 + 1]
    elapsed += holdSeg.durationMs + (transSeg?.durationMs ?? 0)
  }

  // 2) Encode MP4 if the browser supports WebCodecs
  if (isMp4ExportSupported()) {
    onProgress?.({ current: total, total: total + 1 })
    try {
      const mp4Blob = await exportMp4(spec, undefined, options)
      zip.add('koma.mp4', new Uint8Array(await mp4Blob.arrayBuffer()))
    } catch (err) {
      // MP4 encoding failed — ship the zip with PNGs only, but surface
      // the reason so the failure isn't invisible.
      console.error('koma: MP4 export failed, shipping PNG-only zip', err)
    }
  }

  onProgress?.({ current: total + 1, total: total + 1 })
  return zip.finalize()
}

// ── Download helper ───────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
