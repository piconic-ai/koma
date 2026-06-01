// Pre-bundled export entrypoint.
//
// This file is pre-bundled by `scripts/build-export-bundle.mjs` and
// served as `/components/koma-export.js`. AppHeader dynamically imports
// the bundle the first time the user clicks Export, so the heavy export
// pipeline (canvas rendering, zip writer, lazily-fetched mp4-muxer,
// gifenc and shiki) stays out of the eagerly-loaded component bundles.
//
// This also sidestepped bf's transitive inliner dup-identifier bug
// (piconic-ai/barefootjs#1542, fixed in bf 0.4.0). Even with that fix,
// keep the pre-bundle: a static import would inline the whole pipeline
// into AppHeader and load it on every page visit, not on demand.
//
// The pipeline is split across sibling modules (shared/mp4/gif/geometry)
// that esbuild bundles back together via this entrypoint.

import { buildTimeline } from '../model/timeline'
import { type Spec } from '../model/types'
import { renderToCanvas } from '../render/canvas'
import { exportGif } from './gif'
import { exportMp4, isMp4ExportSupported } from './mp4'
import {
  buildRenderOpts,
  canvasToPngBytes,
  ensureFontsReady,
  preloadTokens,
} from './shared'
import type { GifExportOptions, Mp4ExportOptions, ExportProgress } from './types'
import { ZipWriter } from './zip'

export type {
  ExportProgress,
  CommonExportOptions,
  Mp4ExportOptions,
  GifExportOptions,
} from './types'

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
  const pngCount = spec.frames.length
  const pad = String(pngCount).length
  // Coarse progress: one tick per PNG frame, plus one tick each for the
  // (optional) MP4 and the GIF encode phases.
  const total = pngCount + (isMp4ExportSupported() ? 1 : 0) + 1
  let step = 0

  // 1) Render per-frame PNGs
  let elapsed = 0
  for (let i = 0; i < pngCount; i++) {
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
