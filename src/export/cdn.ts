// Lazily-loaded CDN encoder modules. Isolated here so the MP4 and GIF
// paths share one home for the CDN URLs, and so tests can mock the
// loaders (mock.module('./cdn', ...)) instead of hitting the network.

export type MuxerModule = {
  Muxer: new (opts: unknown) => {
    addVideoChunk: (chunk: unknown, meta?: unknown) => void
    finalize: () => void
    target: { buffer: ArrayBuffer }
  }
  ArrayBufferTarget: new () => { buffer: ArrayBuffer }
}

export type GifencModule = {
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

export async function loadMuxer(): Promise<MuxerModule> {
  const url = 'https://esm.sh/mp4-muxer@5.2.2'
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- URL import resolved at runtime by the browser
  const mod = await import(/* @vite-ignore */ url)
  return mod as MuxerModule
}

export async function loadGifenc(): Promise<GifencModule> {
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
