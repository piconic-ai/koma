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

describe('renderToCanvas window chrome', () => {
  const spec: Spec = { language: 'ts', frames: [{ id: 'a', code: 'const x = 1' }] }

  test('draws the three traffic-light dots when chrome is shown', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, holdInputs(spec))
    expect(calls.arc).toBe(3)
  })

  test('skips chrome when showWindowChrome is false', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { showWindowChrome: false },
    })
    expect(calls.arc).toBe(0)
  })

  test('uses overridden chrome colors', () => {
    const { canvas, calls } = makeRecordingCanvas()
    renderToCanvas(canvas, {
      ...holdInputs(spec),
      options: { chromeBackground: '#123456' },
    })
    expect(calls.fillStyles).toContain('#123456')
  })
})
