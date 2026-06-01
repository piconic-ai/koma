// MP4 export path: renders the timeline to a canvas and encodes H.264 via
// the browser's WebCodecs VideoEncoder, muxed with the lazily-fetched
// mp4-muxer. Requires WebCodecs (see isMp4ExportSupported).

import { DEFAULTS, type Spec } from '../model/types'
import { loadMuxer } from './cdn'
import { frameCount } from './geometry'
import {
  ensureFontsReady,
  preloadTokens,
  renderToCanvas,
  setupRender,
} from './shared'
import type { ExportProgress, Mp4ExportOptions } from './types'

export function isMp4ExportSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoEncoder === 'function' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoFrame === 'function'
  )
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
