// Canvas renderer used by PNG and MP4 export.
//
// This is the offline twin of the DOM-based Player. Both consume the
// same `Timeline` so the recorded output matches what's previewed,
// while the canvas path produces pixel-perfect frames at a target
// resolution independent of the screen / DOM.

import { locateInTimeline } from '../model/timeline'
import type { Frame, Timeline } from '../model/types'
import { typingForLine } from '../render/playback'
import type { TokenLine } from '../render/highlighter'

export type RenderOptions = {
  width: number
  height: number
  outerBackground: string
  codeBackground: string
  codeWidth: number
  fontFamily: string
  fontSize: number
  lineHeight: number
  paddingX: number
  paddingY: number
  windowChromeHeight: number
  cornerRadius: number
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  width: 1080,
  height: 1080,
  outerBackground: '#00b769',
  codeBackground: '#0d1117',
  codeWidth: 900,
  fontFamily:
    "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 28,
  lineHeight: 1.6,
  paddingX: 40,
  paddingY: 40,
  windowChromeHeight: 48,
  cornerRadius: 16,
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawWindowChrome(
  ctx: CanvasRenderingContext2D,
  windowX: number,
  windowY: number,
  windowW: number,
  opts: RenderOptions,
) {
  ctx.fillStyle = '#161b22'
  roundRect(ctx, windowX, windowY, windowW, opts.windowChromeHeight, 0)
  ctx.fill()
  const cy = windowY + opts.windowChromeHeight / 2
  const dots: Array<{ x: number; color: string }> = [
    { x: windowX + 24, color: '#ff5f57' },
    { x: windowX + 48, color: '#febc2e' },
    { x: windowX + 72, color: '#28c840' },
  ]
  for (const dot of dots) {
    ctx.beginPath()
    ctx.arc(dot.x, cy, 8, 0, Math.PI * 2)
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

export function heightForFrames(
  frames: Frame[],
  opts: Partial<RenderOptions> = {},
): number {
  const o = { ...DEFAULT_RENDER_OPTIONS, ...opts }
  const maxLines = Math.max(1, ...frames.map(f => f.code.split('\n').length))
  const lineGap = o.fontSize * o.lineHeight
  return Math.ceil(
    80 + o.windowChromeHeight + o.paddingY * 2 + maxLines * lineGap,
  )
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

  const c = ctx as CanvasRenderingContext2D

  // Outer background
  c.fillStyle = opts.outerBackground
  c.fillRect(0, 0, opts.width, opts.height)

  // Code window — centered, fixed width
  const windowW = Math.min(opts.codeWidth, opts.width - 40)
  const windowH = opts.height - 80
  const windowX = (opts.width - windowW) / 2
  const windowY = (opts.height - windowH) / 2

  // Draw rounded-rect code background
  c.fillStyle = opts.codeBackground
  roundRect(c, windowX, windowY, windowW, windowH, opts.cornerRadius)
  c.fill()

  // Clip to the rounded rect so chrome + text don't bleed
  c.save()
  roundRect(c, windowX, windowY, windowW, windowH, opts.cornerRadius)
  c.clip()

  // Chrome
  drawWindowChrome(c, windowX, windowY, windowW, opts)

  // Code
  c.font = `${opts.fontSize}px ${opts.fontFamily}`
  c.textBaseline = 'top'

  const startX = windowX + opts.paddingX
  const startY = windowY + opts.windowChromeHeight + opts.paddingY
  const lineGap = opts.fontSize * opts.lineHeight

  const pos = locateInTimeline(inputs.timeline, inputs.elapsedMs)
  const seg = inputs.timeline.segments[pos.segmentIndex]

  if (seg.type === 'hold') {
    const tokens =
      inputs.tokensByFrame.get(seg.frame.id) ??
      seg.frame.code.split('\n').map(line => [{ content: line }])
    for (let i = 0; i < tokens.length; i++) {
      drawTokenLine(c, tokens[i], startX, startY + i * lineGap, opts.fontSize)
    }
    c.restore()
    return
  }

  const progress = pos.segmentProgress
  let drawY = 0

  for (let i = 0; i < seg.transition.lines.length; i++) {
    const role = seg.transition.lines[i]
    const typing = typingForLine(role, progress)
    if (!typing.visible) continue
    const text =
      typing.visibleChars === -1
        ? role.line
        : role.line.substring(0, typing.visibleChars)
    if (text.length > 0) {
      c.fillStyle = '#c9d1d9'
      c.fillText(text, startX, startY + drawY * lineGap)
    }
    if (typing.showCursor) {
      const cursorX = startX + c.measureText(text).width
      c.fillStyle = '#58a6ff'
      c.fillText('|', cursorX, startY + drawY * lineGap)
    }
    drawY++
  }
  c.restore()
}
