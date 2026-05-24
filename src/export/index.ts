// Pre-bundled export entrypoint.
//
// This file is pre-bundled by `scripts/build-export-bundle.mjs` and
// served as `/components/koma-export.js`. App dynamically imports the
// bundle at runtime, sidestepping bf's transitive inliner (which has
// a duplicate-identifier bug when one component reaches into multiple
// transitive modules that share dependencies — piconic-ai/barefootjs#1542).
//
// `png-sequence.ts` and `mp4.ts` share substantial transitive
// dependencies (`canvas-render`, `timeline`, `highlighter`). The bf
// inliner currently re-inlines those modules per top-level import,
// which produces duplicate `const __bf_inline_N` declarations and
// a SyntaxError in the browser. Routing both exporters through one
// module gives the inliner a single dependency tree.
//
// Tracking: barefootjs/barefootjs issue on transitive-dedup.

import { buildTimeline, collapseTransitions } from '../model/timeline'
import { DEFAULTS, type Spec } from '../model/types'
import { highlight, type TokenLine } from '../render/highlighter'
import {
  DEFAULT_RENDER_OPTIONS,
  heightForFrames,
  renderToCanvas,
  type RenderOptions,
} from './canvas-render'
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

export type PngSequenceOptions = CommonExportOptions

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

function setupRender(spec: Spec, options: CommonExportOptions) {
  const fps = options.fps ?? DEFAULTS.fps
  const renderOpts: RenderOptions = {
    ...DEFAULT_RENDER_OPTIONS,
    ...options.render,
    height: options.render?.height ?? heightForFrames(spec.frames),
  }
  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline
  return { fps, renderOpts, timeline }
}

// ── PNG sequence ──────────────────────────────────────────────────

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

export async function exportPngSequence(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: PngSequenceOptions = {},
): Promise<Blob> {
  const renderOpts: RenderOptions = {
    ...DEFAULT_RENDER_OPTIONS,
    ...options.render,
    height: options.render?.height ?? heightForFrames(spec.frames),
  }
  const tokensByFrame = await preloadTokens(spec)
  const timeline = buildTimeline(spec)
  const canvas = document.createElement('canvas')
  canvas.width = renderOpts.width
  canvas.height = renderOpts.height
  const total = spec.frames.length
  const zip = new ZipWriter()
  const pad = String(total).length

  // Render each frame's hold state (t = start of that frame's hold
  // segment). Hold segments are at indices 0, 2, 4, ... in the timeline.
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
    onProgress?.({ current: i + 1, total })
    // Advance past this hold + next transition to reach the next hold.
    const holdSeg = timeline.segments[i * 2]
    const transSeg = timeline.segments[i * 2 + 1]
    elapsed += holdSeg.durationMs + (transSeg?.durationMs ?? 0)
  }
  return zip.finalize()
}

// ── MP4 ───────────────────────────────────────────────────────────

export function isMp4ExportSupported(): boolean {
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

export async function exportMp4(
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
