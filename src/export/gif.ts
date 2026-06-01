// GIF export path. Unlike the MP4 path this only needs a 2D canvas, so it
// works wherever the PNG export does (no WebCodecs required). Each frame
// is rendered, optionally downscaled, and given a local 256-colour
// palette via the lazily-fetched gifenc.

import { buildTimeline, collapseTransitions } from '../model/timeline'
import { type Spec } from '../model/types'
import { renderToCanvas } from '../render/canvas'
import { loadGifenc } from './cdn'
import { frameCount, gifFrameDelayMs, gifOutputSize } from './geometry'
import { buildRenderOpts, ensureFontsReady, preloadTokens } from './shared'
import type { ExportProgress, GifExportOptions } from './types'

// GIF runs at a gentler frame rate than the video so the palette-limited
// file stays small.
const GIF_DEFAULT_FPS = 15

export async function exportGif(
  spec: Spec,
  onProgress?: (p: ExportProgress) => void,
  options: GifExportOptions = {},
): Promise<Blob> {
  const fps = options.gifFps ?? GIF_DEFAULT_FPS
  const renderOpts = buildRenderOpts(spec, options)
  const rawTimeline = buildTimeline(spec)
  const timeline = options.reduceMotion
    ? collapseTransitions(rawTimeline)
    : rawTimeline
  const tokensByFrame = await preloadTokens(spec)
  await ensureFontsReady(renderOpts)

  const { GIFEncoder, quantize, applyPalette } = await loadGifenc()

  // Half the video size by default; `gifMaxDimension` pins the longest side.
  const { width: outW, height: outH } = gifOutputSize(
    renderOpts.width,
    renderOpts.height,
    options.gifMaxDimension,
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
