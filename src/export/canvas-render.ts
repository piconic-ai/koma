// Canvas renderer used by PNG and MP4 export.
//
// This is the offline twin of the DOM-based Player. Both consume the
// same `Timeline` so the recorded output matches what's previewed,
// while the canvas path produces pixel-perfect frames at a target
// resolution independent of the screen / DOM.

import { locateInTimeline } from '../model/timeline'
import type { Frame, Timeline } from '../model/types'
import { styleForLine } from '../render/playback'
import type { TokenLine } from '../render/highlighter'

export type RenderOptions = {
  width: number
  height: number
  background: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  paddingX: number
  paddingY: number
  windowChromeHeight: number
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  width: 1080,
  height: 1080,
  background: '#0d1117',
  fontFamily:
    "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 28,
  lineHeight: 1.6,
  paddingX: 56,
  paddingY: 56,
  windowChromeHeight: 56,
}

function drawWindowChrome(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
) {
  // Title bar background
  ctx.fillStyle = '#161b22'
  ctx.fillRect(0, 0, opts.width, opts.windowChromeHeight)
  // Three traffic-light dots
  const cy = opts.windowChromeHeight / 2
  const dots: Array<{ x: number; color: string }> = [
    { x: 28, color: '#ff5f57' },
    { x: 56, color: '#febc2e' },
    { x: 84, color: '#28c840' },
  ]
  for (const dot of dots) {
    ctx.beginPath()
    ctx.arc(dot.x, cy, 10, 0, Math.PI * 2)
    ctx.fillStyle = dot.color
    ctx.fill()
  }
}

function drawTokenLine(
  ctx: CanvasRenderingContext2D,
  tokens: TokenLine,
  x: number,
  y: number,
  fontSize: number,
) {
  let cursor = x
  for (const token of tokens) {
    ctx.fillStyle = token.color ?? '#c9d1d9'
    ctx.fillText(token.content, cursor, y)
    cursor += ctx.measureText(token.content).width
  }
  void fontSize
}

export type RenderInputs = {
  timeline: Timeline
  elapsedMs: number
  tokensByFrame: Map<string, TokenLine[]>
  frames: Frame[]
  options?: Partial<RenderOptions>
}

export function renderToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  inputs: RenderInputs,
): void {
  const opts: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...inputs.options }
  canvas.width = opts.width
  canvas.height = opts.height

  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) return

  // Background
  ctx.fillStyle = opts.background
  ctx.fillRect(0, 0, opts.width, opts.height)

  // Chrome
  drawWindowChrome(ctx as CanvasRenderingContext2D, opts)

  // Code
  ctx.font = `${opts.fontSize}px ${opts.fontFamily}`
  ctx.textBaseline = 'top'

  const startX = opts.paddingX
  const startY = opts.windowChromeHeight + opts.paddingY
  const lineGap = opts.fontSize * opts.lineHeight

  const pos = locateInTimeline(inputs.timeline, inputs.elapsedMs)
  const seg = inputs.timeline.segments[pos.segmentIndex]

  if (seg.type === 'hold') {
    const tokens =
      inputs.tokensByFrame.get(seg.frame.id) ??
      seg.frame.code.split('\n').map(line => [{ content: line }])
    for (let i = 0; i < tokens.length; i++) {
      drawTokenLine(
        ctx as CanvasRenderingContext2D,
        tokens[i],
        startX,
        startY + i * lineGap,
        opts.fontSize,
      )
    }
    return
  }

  // Transition: blend per-line opacity / translate, using token
  // colors from the destination frame for keep/add lines and the
  // source frame for remove lines.
  const fromTokens = inputs.tokensByFrame.get(seg.transition.fromFrameId)
  const toTokens = inputs.tokensByFrame.get(seg.transition.toFrameId)
  const progress = pos.segmentProgress

  for (let i = 0; i < seg.transition.lines.length; i++) {
    const role = seg.transition.lines[i]
    const style = styleForLine(role, progress)
    if (style.opacity <= 0) continue
    const lineTokens: TokenLine =
      role.type === 'remove'
        ? fromTokens?.[role.fromIndex] ?? [{ content: role.line }]
        : toTokens?.[role.toIndex] ?? [{ content: role.line }]
    ctx.globalAlpha = style.opacity
    drawTokenLine(
      ctx as CanvasRenderingContext2D,
      lineTokens,
      startX,
      startY + i * lineGap + style.translateY,
      opts.fontSize,
    )
  }
  ctx.globalAlpha = 1
}
