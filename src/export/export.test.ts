import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { ExportProgress } from './types'

// The export functions are browser-bound (canvas, WebCodecs, CDN-loaded
// encoders). We mock the export-local seams (./cdn, ./shared, the
// renderer and the timeline) once, consistently, and stub a minimal
// window/document. Bun's mock.module is global for the whole run, so all
// three SUTs share this single mock set — exportAll therefore drives the
// *real* exportGif/exportMp4 over the same fakes rather than mocking them,
// which keeps the orchestration test honest.

// ── shared fakes + control state ──────────────────────────────────

type WriteFrameCall = {
  width: number
  height: number
  opts: { palette: number[][]; delay?: number; repeat?: number }
}
let writeFrames: WriteFrameCall[] = []
let encodeCalls: { keyFrame?: boolean }[] = []
let configuredCodec: string | null = null

const ALL_CODECS = ['avc1.42E01E', 'avc1.42E028', 'avc1.4D4028', 'avc1.640028']
let supportedCodecs = new Set(ALL_CODECS)
let gifencThrows = false

const fakeGif = {
  writeFrame: (_i: Uint8Array, width: number, height: number, opts: WriteFrameCall['opts']) =>
    writeFrames.push({ width, height, opts }),
  finish: () => {},
  bytes: () => new Uint8Array([0x47, 0x49, 0x46]),
}

class FakeVideoEncoder {
  state = 'configured'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_init: any) {}
  configure(cfg: { codec: string }) {
    configuredCodec = cfg.codec
  }
  encode(_frame: unknown, opts?: { keyFrame?: boolean }) {
    encodeCalls.push(opts ?? {})
  }
  async flush() {}
  close() {}
  static isConfigSupported(cfg: { codec: string }) {
    return Promise.resolve({ supported: supportedCodecs.has(cfg.codec) })
  }
}
class FakeVideoFrame {
  constructor(_src: unknown, _init: unknown) {}
  close() {}
}

mock.module('./cdn', () => ({
  loadGifenc: async () => {
    if (gifencThrows) throw new Error('gifenc load failed')
    return {
      GIFEncoder: () => fakeGif,
      quantize: () => [[0, 0, 0]],
      applyPalette: () => new Uint8Array(1),
    }
  },
  loadMuxer: async () => ({
    ArrayBufferTarget: class {
      buffer = new ArrayBuffer(8)
    },
    Muxer: class {
      addVideoChunk() {}
      finalize() {}
    },
  }),
}))
mock.module('./shared', () => ({
  buildRenderOpts: () => ({ width: 100, height: 80 }),
  setupRender: () => ({
    fps: 10,
    renderOpts: { width: 100, height: 80 },
    timeline: { segments: [], totalDurationMs: 200 },
  }),
  preloadTokens: async () => new Map(),
  ensureFontsReady: async () => {},
  canvasToPngBytes: async () => new Uint8Array([3, 4, 5]),
}))
mock.module('../render/canvas', () => ({ renderToCanvas: () => {} }))
mock.module('../model/timeline', () => ({
  // 2 frames -> 4 segments (hold + transition each); 400ms total.
  buildTimeline: () => ({
    segments: Array.from({ length: 4 }, () => ({ durationMs: 100 })),
    totalDurationMs: 400,
  }),
  collapseTransitions: (t: unknown) => t,
}))

function installEnv(withWebCodecs = true) {
  ;(globalThis as { window?: unknown }).window = withWebCodecs
    ? { VideoEncoder: FakeVideoEncoder, VideoFrame: FakeVideoFrame }
    : {}
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(16) }),
      }),
    }),
  }
}

beforeEach(() => {
  writeFrames = []
  encodeCalls = []
  configuredCodec = null
  supportedCodecs = new Set(ALL_CODECS)
  gifencThrows = false
  installEnv(true)
  // Graceful-degradation paths log expected errors; keep test output clean.
  spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  ;(console.error as ReturnType<typeof spyOn>).mockRestore?.()
})

// bun-types mistypes `.rejects.toThrow` as non-thenable; capture directly.
async function rejectionMessage(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

const { exportGif } = await import('./gif')
const { exportMp4 } = await import('./mp4')
const { exportAll } = await import('./index')

const spec = { frames: [{ id: 'a', code: 'x' }, { id: 'b', code: 'y' }], theme: 't' } as never

// ── GIF ────────────────────────────────────────────────────────────

describe('exportGif', () => {
  test('returns an image/gif blob', async () => {
    expect((await exportGif(spec, undefined, { gifFps: 10 })).type).toBe('image/gif')
  })

  test('writes one frame per timeline sample (400ms @ 10fps = 4)', async () => {
    await exportGif(spec, undefined, { gifFps: 10 })
    expect(writeFrames).toHaveLength(4)
  })

  test('loops: only the first frame carries repeat: 0', async () => {
    await exportGif(spec, undefined, { gifFps: 10 })
    expect(writeFrames[0].opts.repeat).toBe(0)
    expect(writeFrames.slice(1).every(f => f.opts.repeat === undefined)).toBe(true)
  })

  test('snaps every frame delay to the 10ms grid (10fps -> 100ms)', async () => {
    await exportGif(spec, undefined, { gifFps: 10 })
    expect(writeFrames.every(f => f.opts.delay === 100)).toBe(true)
  })

  test('defaults output to half the source size', async () => {
    await exportGif(spec, undefined, { gifFps: 10 })
    expect(writeFrames[0]).toMatchObject({ width: 50, height: 40 })
  })

  test('honours gifMaxDimension by pinning the longest side', async () => {
    await exportGif(spec, undefined, { gifFps: 10, gifMaxDimension: 20 })
    expect(writeFrames[0]).toMatchObject({ width: 20, height: 16 })
  })

  test('reports progress once per frame, ending at total', async () => {
    const seen: ExportProgress[] = []
    await exportGif(spec, p => seen.push(p), { gifFps: 10 })
    expect(seen).toHaveLength(4)
    expect(seen.at(-1)).toEqual({ current: 4, total: 4 })
  })
})

// ── MP4 ────────────────────────────────────────────────────────────

describe('exportMp4', () => {
  test('returns a video/mp4 blob', async () => {
    expect((await exportMp4(spec, undefined, {})).type).toBe('video/mp4')
  })

  test('encodes one frame per sample with keyframes on fps boundaries', async () => {
    await exportMp4(spec, undefined, {})
    // 200ms @ 10fps -> 2 frames; keyFrame when i % fps === 0
    expect(encodeCalls.map(c => c.keyFrame)).toEqual([true, false])
  })

  test('selects the first H.264 profile the browser accepts', async () => {
    await exportMp4(spec, undefined, {})
    expect(configuredCodec).toBe('avc1.42E01E')
  })

  test('falls through to the next profile when leaner ones are unsupported', async () => {
    supportedCodecs = new Set(['avc1.42E028'])
    await exportMp4(spec, undefined, {})
    expect(configuredCodec).toBe('avc1.42E028')
  })

  test('throws when no H.264 profile is supported', async () => {
    supportedCodecs = new Set()
    expect(await rejectionMessage(exportMp4(spec, undefined, {}))).toMatch(/No supported H\.264/)
  })

  test('throws when WebCodecs is unavailable', async () => {
    installEnv(false)
    expect(await rejectionMessage(exportMp4(spec, undefined, {}))).toMatch(/WebCodecs/)
  })
})

// ── Combined (exportAll) ─────────────────────────────────────────────

// EOCD (end-of-central-directory) entry count lives 22 bytes from the tail.
async function zipInfo(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const dv = new DataView(buf.buffer, buf.byteOffset + buf.length - 22)
  const text = new TextDecoder().decode(buf)
  return { count: dv.getUint16(8, true), has: (name: string) => text.includes(name) }
}

describe('exportAll', () => {
  test('packs PNG frames, MP4 and GIF into one zip', async () => {
    const zip = await zipInfo(await exportAll(spec))
    expect(zip.count).toBe(4) // 2 PNGs + mp4 + gif
    expect(zip.has('frame_1.png')).toBe(true)
    expect(zip.has('frame_2.png')).toBe(true)
    expect(zip.has('koma.mp4')).toBe(true)
    expect(zip.has('koma.gif')).toBe(true)
  })

  test('progress is monotonic and ends at total', async () => {
    const seen: ExportProgress[] = []
    await exportAll(spec, p => seen.push(p))
    const total = 2 + 1 + 1 // PNGs + mp4 phase + gif phase
    expect(seen.at(-1)).toEqual({ current: total, total })
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].current).toBeGreaterThanOrEqual(seen[i - 1].current)
      expect(seen[i].total).toBe(total)
    }
  })

  test('skips MP4 (and its progress slot) when WebCodecs is unavailable', async () => {
    installEnv(false)
    const zip = await zipInfo(await exportAll(spec))
    expect(zip.has('koma.mp4')).toBe(false)
    expect(zip.has('koma.gif')).toBe(true)
    expect(zip.count).toBe(3) // 2 PNGs + gif
  })

  test('still ships the zip when MP4 encoding throws', async () => {
    supportedCodecs = new Set() // exportMp4 throws "No supported H.264 profile"
    const zip = await zipInfo(await exportAll(spec))
    expect(zip.has('koma.mp4')).toBe(false)
    expect(zip.has('koma.gif')).toBe(true)
    expect(zip.count).toBe(3)
  })

  test('still ships the zip when GIF encoding throws', async () => {
    gifencThrows = true
    const zip = await zipInfo(await exportAll(spec))
    expect(zip.has('koma.gif')).toBe(false)
    expect(zip.has('koma.mp4')).toBe(true)
    expect(zip.count).toBe(3)
  })
})
