import type { RenderOptions } from '../render/canvas'

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
