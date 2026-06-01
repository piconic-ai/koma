// Pure geometry / timing helpers shared by the export paths. Kept free
// of DOM/browser deps so they can be unit-tested directly.

// The GIF is half the video resolution by default, so the palette-limited
// file stays small while tracking whatever size the video is exported at.
export const GIF_DEFAULT_SCALE = 0.5

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
