import { describe, expect, test } from 'bun:test'
import { heightForFrames, renderToCanvas, truncateTokenLine } from './canvas'
import type { TokenLine } from './highlighter'
import { buildTimeline } from '../model/timeline'
import type { Spec } from '../model/types'

// A minimal 2D-context recorder. The real CanvasRenderingContext2D isn't
// available under bun, so we capture the calls renderToCanvas makes and
// assert on them.
function makeRecordingCanvas() {
  const calls = {
    clearRect: 0,
    fillRect: 0,
    arc: 0,
    gradients: [] as Array<Array<[number, string]>>,
    fillStyles: [] as unknown[],
  }
  const ctx = {
    fillStyle: '' as unknown,
    font: '',
    textBaseline: '',
    clearRect: () => {
      calls.clearRect++
    },
    createLinearGradient: () => {
      const stops: Array<[number, string]> = []
      calls.gradients.push(stops)
      return { addColorStop: (offset: number, color: string) => { stops.push([offset, color]) } }
    },
    fillRect: () => {
      calls.fillRect++
      calls.fillStyles.push(ctx.fillStyle)
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    arc: () => {
      calls.arc++
    },
    fill: () => {
      calls.fillStyles.push(ctx.fillStyle)
    },
    save: () => {},
    clip: () => {},
    restore: () => {},
    measureText: () => ({ width: 10 }),
    fillText: () => {},
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, calls }
}

function holdInputs(spec: Spec) {
  return {
    timeline: buildTimeline(spec),
    elapsedMs: 0,
    tokensByFrame: new Map<string, TokenLine[]>(),
    frames: spec.frames,
  }
}

describe('truncateTokenLine', () => {
  const line: TokenLine = [
    { content: 'const', color: '#ff7b72' },
    { content: ' x = ', color: '#c9d1d9' },
    { content: '42', color: '#79c0ff' },
  ]

  test('chars=-1 returns all tokens unchanged', () => {
    expect(truncateTokenLine(line, -1)).toEqual(line)
  })

  test('chars=0 returns empty', () => {
    expect(truncateTokenLine(line, 0)).toEqual([])
  })

  test('truncates mid-token', () => {
    const result = truncateTokenLine(line, 3)
    expect(result).toEqual([
      { content: 'con', color: '#ff7b72' },
    ])
  })

  test('truncates at exact token boundary', () => {
    const result = truncateTokenLine(line, 5)
    expect(result).toEqual([
      { content: 'const', color: '#ff7b72' },
    ])
  })

  test('truncates across tokens', () => {
    const result = truncateTokenLine(line, 8)
    expect(result).toEqual([
      { content: 'const', color: '#ff7b72' },
      { content: ' x ', color: '#c9d1d9' },
    ])
  })

  test('chars >= total length returns all tokens', () => {
    const result = truncateTokenLine(line, 100)
    expect(result).toEqual(line)
  })

  test('handles empty token list', () => {
    expect(truncateTokenLine([], 5)).toEqual([])
  })

  test('handles tokens without color', () => {
    const plain: TokenLine = [{ content: 'hello world' }]
    const result = truncateTokenLine(plain, 5)
    expect(result).toEqual([{ content: 'hello' }])
  })
})

describe('heightForFrames', () => {
  test('single line returns minimum height', () => {
    const h = heightForFrames([{ id: 'a', code: 'x' }])
    expect(h).toBeGreaterThan(0)
  })

  test('more lines produce greater height', () => {
    const h1 = heightForFrames([{ id: 'a', code: 'a' }])
    const h5 = heightForFrames([{ id: 'a', code: 'a\nb\nc\nd\ne' }])
    expect(h5).toBeGreaterThan(h1)
  })

  test('uses max line count across all frames', () => {
    const hShort = heightForFrames([{ id: 'a', code: 'a' }])
    const hMixed = heightForFrames([
      { id: 'a', code: 'a' },
      { id: 'b', code: 'a\nb\nc' },
    ])
    expect(hMixed).toBeGreaterThan(hShort)
  })

  test('respects option overrides', () => {
    const frames = [{ id: 'a', code: 'a\nb' }]
    const h1 = heightForFrames(frames, { fontSize: 28 })
    const h2 = heightForFrames(frames, { fontSize: 14 })
    expect(h1).toBeGreaterThan(h2)
  })

  test('always returns an even height (H.264 mp4 export needs even dims)', () => {
    for (let lines = 1; lines <= 12; lines++) {
      const code = Array.from({ length: lines }, (_, i) => `line${i}`).join('\n')
      expect(heightForFrames([{ id: 'a', code }]) % 2).toBe(0)
    }
  })
})

describe('renderToCanvas outer background', () => {
  const spec: Spec = { language: 'ts', frames: [{ id: 'a', code: 'const x = 1' }] }

  test('paints a solid outer background by default', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, holdInputs(spec))
    expect(calls.clearRect).toBe(0)
    expect(calls.fillRect).toBe(1)
    expect(calls.fillStyles).toContain('#00b769')
  })

  test('clears (keeps alpha) when outerBackground is transparent', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { outerBackground: 'transparent' },
    })
    expect(calls.clearRect).toBe(1)
    expect(calls.fillRect).toBe(0)
  })

  test('paints a vertical gradient when outerGradient is set', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { outerGradient: { from: '#ff8844', to: '#ff3300' } },
    })
    expect(calls.clearRect).toBe(0)
    expect(calls.gradients.length).toBe(1)
    expect(calls.gradients[0]).toEqual([[0, '#ff8844'], [1, '#ff3300']])
  })
})

describe('renderToCanvas 和柄 pattern', () => {
  const spec: Spec = { language: 'ts', frames: [{ id: 'a', code: 'const x = 1' }] }

  // A 2D-context stub that also supports the motif path: createPattern on the
  // main canvas, and stroke/fill counters used by the offscreen tile.
  function makePatternCtx(counters: { strokes: number; fills: number; patterns: number }) {
    return {
      fillStyle: '' as unknown, strokeStyle: '', lineJoin: '', lineCap: '', lineWidth: 0,
      globalAlpha: 1, globalCompositeOperation: '', font: '', textBaseline: '',
      beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
      arc() {}, save() {}, restore() {}, clip() {}, fillText() {}, clearRect() {}, fillRect() {},
      stroke() { counters.strokes++ }, fill() { counters.fills++ },
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createPattern: () => { counters.patterns++; return {} },
    }
  }

  test('builds a motif tile and stamps it over the background', () => {
    const counters = { strokes: 0, fills: 0, patterns: 0 }
    const ctx = makePatternCtx(counters)
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement

    // Drive the tile builder through a shimmed OffscreenCanvas. We also
    // neutralise any `document` another test file may have leaked, since the
    // tile builder prefers it (and that stub canvas is incomplete here).
    const g = globalThis as { OffscreenCanvas?: unknown; document?: unknown }
    const prevOSC = g.OffscreenCanvas
    const prevDoc = g.document
    g.document = undefined
    g.OffscreenCanvas = class {
      width = 0; height = 0
      constructor(w: number, h: number) { this.width = w; this.height = h }
      getContext() { return makePatternCtx(counters) }
    }
    try {
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        // grain off so only the pattern path exercises the shimmed tile.
        // A unique color+scale key avoids the module-level tile cache.
        options: { grainAlpha: 0, outerPattern: { kind: 'seigaiha', color: '#123456', opacity: 0.1, scale: 97 } },
      })
    } finally {
      g.OffscreenCanvas = prevOSC
      g.document = prevDoc
    }
    // The seigaiha tile strokes its arcs; the main canvas stamps it as a pattern.
    expect(counters.strokes).toBeGreaterThan(0)
    expect(counters.patterns).toBeGreaterThan(0)
  })

  test('is safely skipped when the context has no createPattern (unit stub)', () => {
    const { canvas } = makeRecordingCanvas()
    expect(() =>
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        options: { outerPattern: { kind: 'sakura', color: '#ffffff' } },
      }),
    ).not.toThrow()
  })
})

describe('renderToCanvas 金雲 gold leaf', () => {
  const spec: Spec = { language: 'ts', frames: [{ id: 'a', code: 'const x = 1' }] }

  test('builds an organic gold layer and stamps it onto the canvas', () => {
    const seen = { radial: 0, drawImage: 0 }
    const tileCtx = {
      fillStyle: '' as unknown, strokeStyle: '', globalAlpha: 1, lineJoin: '', lineCap: '', lineWidth: 0,
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {}, fill() {}, fillRect() {},
      createRadialGradient() { seen.radial++; return { addColorStop() {} } },
    }
    const mainCtx = {
      fillStyle: '' as unknown, font: '', textBaseline: '',
      clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      closePath() {}, arc() {}, fill() {}, save() {}, clip() {}, restore() {}, fillText() {},
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      drawImage() { seen.drawImage++ },
    }
    const canvas = { width: 0, height: 0, getContext: () => mainCtx } as unknown as HTMLCanvasElement

    const g = globalThis as { OffscreenCanvas?: unknown; document?: unknown }
    const prevOSC = g.OffscreenCanvas
    const prevDoc = g.document
    g.document = undefined
    g.OffscreenCanvas = class {
      width = 0; height = 0
      constructor(w: number, h: number) { this.width = w; this.height = h }
      getContext() { return tileCtx }
    }
    try {
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        // unique seed avoids the module-level gold-layer cache.
        options: { grainAlpha: 0, vignette: 0, outerGold: { color: '#c9a24e', corners: ['tl', 'br'], seed: 4242 } },
      })
    } finally {
      g.OffscreenCanvas = prevOSC
      g.document = prevDoc
    }
    expect(seen.radial).toBeGreaterThan(0) // gold stamps built via radial gradients
    expect(seen.drawImage).toBe(1) // layer stamped once onto the canvas
  })

  test('is safely skipped when the context cannot draw images (unit stub)', () => {
    const { canvas } = makeRecordingCanvas()
    expect(() =>
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        options: { outerGold: { color: '#c9a24e', corners: ['tl'] } },
      }),
    ).not.toThrow()
  })

  test('washi texture is safely skipped without createPattern (unit stub)', () => {
    const { canvas } = makeRecordingCanvas()
    expect(() =>
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        options: { washi: { color: '#d8cdb4', alpha: 0.5 } },
      }),
    ).not.toThrow()
  })

  test('gold brush stroke is safely skipped without drawImage (unit stub)', () => {
    const { canvas } = makeRecordingCanvas()
    expect(() =>
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        options: { goldBrush: { color: '#edc55a', from: [0, 0], to: [1, 1] } },
      }),
    ).not.toThrow()
  })

  test('builds a dry-brush gold layer and stamps it onto the canvas', () => {
    const seen = { putImageData: 0, drawImage: 0 }
    const tileCtx = {
      fillStyle: '' as unknown, lineWidth: 0, lineCap: '', globalAlpha: 1,
      beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, fill() {}, fillRect() {}, stroke() {},
      createImageData: (cw: number, ch: number) => ({ data: new Uint8ClampedArray(cw * ch * 4), width: cw, height: ch }),
      getImageData: (_x: number, _y: number, cw: number, ch: number) => ({ data: new Uint8ClampedArray(cw * ch * 4), width: cw, height: ch }),
      putImageData() { seen.putImageData++ },
    }
    const mainCtx = {
      fillStyle: '' as unknown, font: '', textBaseline: '',
      clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      closePath() {}, arc() {}, fill() {}, save() {}, clip() {}, restore() {}, fillText() {},
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      drawImage() { seen.drawImage++ },
    }
    const canvas = { width: 0, height: 0, getContext: () => mainCtx } as unknown as HTMLCanvasElement
    const g = globalThis as { OffscreenCanvas?: unknown; document?: unknown }
    const prevOSC = g.OffscreenCanvas
    const prevDoc = g.document
    g.document = undefined
    g.OffscreenCanvas = class {
      width = 0; height = 0
      constructor(w: number, h: number) { this.width = w; this.height = h }
      getContext() { return tileCtx }
    }
    try {
      renderToCanvas(canvas, {
        ...holdInputs(spec),
        // unique seed avoids the module-level brush-layer cache.
        options: { grainAlpha: 0, vignette: 0, goldBrush: { color: '#edc55a', from: [0.04, 0.16], to: [0.92, 0.86], seed: 9191 } },
      })
    } finally {
      g.OffscreenCanvas = prevOSC
      g.document = prevDoc
    }
    expect(seen.putImageData).toBe(1) // paper-tooth pixels painted
    expect(seen.drawImage).toBe(1) // layer stamped once
  })
})

describe('renderToCanvas window chrome', () => {
  const spec: Spec = { language: 'ts', frames: [{ id: 'a', code: 'const x = 1' }] }

  test('draws no window chrome by default', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, holdInputs(spec))
    expect(calls.arc).toBe(0)
  })

  test('draws the three traffic-light dots when chrome is explicitly enabled', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { showWindowChrome: true },
    })
    expect(calls.arc).toBe(3)
  })

  test('uses overridden chrome colors', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { showWindowChrome: true, chromeBackground: '#123456' },
    })
    expect(calls.fillStyles).toContain('#123456')
  })
})
