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
import { frameLanguage } from '../model/spec'
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

export type GifExportOptions = CommonExportOptions & {
  // GIF keeps its own frame rate, independent from the MP4 options, so
  // that customizing the (lossless-ish) MP4 export never bloats the GIF.
  // People who want fine control over size/quality use the MP4.
  gifFps?: number
  // Optional cap on the longest side, in pixels. When omitted the GIF
  // is half the video's pixel dimensions; set it to pin the longest
  // side to a specific value instead.
  gifMaxDimension?: number
}

// The GIF is half the video resolution by default, and its frame rate is
// dialled back, so the palette-limited file stays small while tracking
// whatever size the video is exported at.
const GIF_DEFAULT_FPS = 15
const GIF_DEFAULT_SCALE = 0.5

// ── Pure geometry / timing helpers (exported for testing) ─────────

// Number of frames sampled from a timeline of `durationMs` at `fps`.
// Always at least one frame, even for a zero-length timeline.
export function frameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.ceil(durationMs / (1000 / fps)))
}

// Output dimensions for the GIF. By default the GIF is half the source
// size; passing `maxDimension` instead pins the longest side to that many
// pixels (never upscaling). Dimensions are rounded and floored at 1px.
export function gifOutputSize(
  width: number,
  height: number,
  maxDimension?: number,
): { width: number; height: number } {
  const scale = maxDimension
    ? Math.min(1, maxDimension / Math.max(width, height))
    : GIF_DEFAULT_SCALE
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

// GIF frame delay in milliseconds. The GIF format stores delays in
// centiseconds, so snap to a 10ms grid and clamp to a 2ms floor (roughly
// the smallest delay players actually honour).
export function gifFrameDelayMs(fps: number): number {
  return Math.max(2, Math.round(1000 / fps / 10) * 10)
}

async function preloadTokens(spec: Spec): Promise<Map<string, TokenLine[]>> {
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
  const total = frameCount(timeline.totalDurationMs, fps)
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

// ── GIF (internal) ───────────────────────────────────────────────

type GifencModule = {
  GIFEncoder: () => {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number; repeat?: number },
    ) => void
    finish: () => void
    bytes: () => Uint8Array<ArrayBuffer>
  }
  quantize: (rgba: Uint8Array | Uint8ClampedArray, maxColors: number) => number[][]
  applyPalette: (
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
  ) => Uint8Array
}

async function loadGifenc(): Promise<GifencModule> {
  // jsDelivr's `+esm` build exposes gifenc's named exports (GIFEncoder,
  // quantize, applyPalette) cleanly. esm.sh mangles gifenc's interop:
  // its `default` collapses to just the GIFEncoder function and the
  // other exports drop, so we use jsDelivr here (mp4-muxer/shiki still
  // come from esm.sh, which handles those fine).
  const url = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm'
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- URL import resolved at runtime by the browser
  const mod = await import(/* @vite-ignore */ url)
  return mod as GifencModule
}

// Encode the timeline as an animated GIF. Unlike the MP4 path this only
// needs a 2D canvas, so it works wherever the PNG export does (no
// WebCodecs required). Frames are downscaled to `gifMaxDimension` and
// each gets a local 256-colour palette via gifenc.
async function exportGif(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: GifExportOptions = {},
): Promise<Blob> {
  const fps = options.gifFps ?? GIF_DEFAULT_FPS
  const maxDimension = options.gifMaxDimension
  const renderOpts = buildRenderOpts(spec, options)
  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline
  const tokensByFrame = await preloadTokens(spec)
  await ensureFontsReady(renderOpts)

  const { GIFEncoder, quantize, applyPalette } = await loadGifenc()

  const { width: outW, height: outH } = gifOutputSize(
    renderOpts.width,
    renderOpts.height,
    maxDimension,
  )

  const full = document.createElement('canvas')
  full.width = renderOpts.width
  full.height = renderOpts.height

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const outCtx = out.getContext('2d', { willReadFrequently: true })
  if (!outCtx) throw new Error('Failed to acquire 2D context for GIF export')
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  const gif = GIFEncoder()
  const dt = 1000 / fps
  const total = frameCount(timeline.totalDurationMs, fps)
  const delay = gifFrameDelayMs(fps)

  for (let i = 0; i < total; i++) {
    renderToCanvas(full, {
      timeline,
      elapsedMs: i * dt,
      tokensByFrame,
      frames: spec.frames,
      options: renderOpts,
    })
    outCtx.drawImage(full, 0, 0, outW, outH)
    const { data } = outCtx.getImageData(0, 0, outW, outH)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, outW, outH, {
      palette,
      delay,
      // Loop forever; only meaningful on the first frame.
      ...(i === 0 ? { repeat: 0 } : {}),
    })
    onProgress?.({ current: i + 1, total })

    if (i % 10 === 9) await new Promise(r => setTimeout(r, 0))
  }

  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

// ── Combined export (MP4 + GIF + PNGs in one zip) ─────────────────

export async function exportAll(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: Mp4ExportOptions & GifExportOptions = {},
): Promise<Blob> {
  const renderOpts = buildRenderOpts(spec, options)
  const tokensByFrame = await preloadTokens(spec)
  await ensureFontsReady(renderOpts)
  // PNG frames use the full (non-reduced-motion) timeline; only the embedded
  // MP4/GIF (via their own setup) collapse transitions.
  const timeline = buildTimeline(spec)
  const canvas = document.createElement('canvas')
  canvas.width = renderOpts.width
  canvas.height = renderOpts.height

  const zip = new ZipWriter()
  const frameCount = spec.frames.length
  const pad = String(frameCount).length
  // Coarse progress: one tick per PNG frame, plus one tick each for the
  // (optional) MP4 and the GIF encode phases.
  const total = frameCount + (isMp4ExportSupported() ? 1 : 0) + 1
  let step = 0

  // 1) Render per-frame PNGs
  let elapsed = 0
  for (let i = 0; i < frameCount; i++) {
    renderToCanvas(canvas, {
      timeline,
      elapsedMs: elapsed,
      tokensByFrame,
      frames: spec.frames,
      options: renderOpts,
    })
    const bytes = await canvasToPngBytes(canvas)
    zip.add(`frame_${String(i + 1).padStart(pad, '0')}.png`, bytes)
    onProgress?.({ current: ++step, total })
    const holdSeg = timeline.segments[i * 2]
    const transSeg = timeline.segments[i * 2 + 1]
    elapsed += holdSeg.durationMs + (transSeg?.durationMs ?? 0)
  }

  // 2) Encode MP4 if the browser supports WebCodecs
  if (isMp4ExportSupported()) {
    onProgress?.({ current: step, total })
    try {
      const mp4Blob = await exportMp4(spec, undefined, options)
      zip.add('koma.mp4', new Uint8Array(await mp4Blob.arrayBuffer()))
    } catch (err) {
      // MP4 encoding failed — ship the zip without it, but surface the
      // reason so the failure isn't invisible.
      console.error('koma: MP4 export failed, skipping MP4', err)
    }
    step++
  }

  // 3) Encode an animated GIF (canvas-only, so always attempted)
  onProgress?.({ current: step, total })
  try {
    const gifBlob = await exportGif(spec, undefined, options)
    zip.add('koma.gif', new Uint8Array(await gifBlob.arrayBuffer()))
  } catch (err) {
    console.error('koma: GIF export failed, skipping GIF', err)
  }
  step++

  onProgress?.({ current: total, total })
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
