// Canvas renderer shared by the Player preview and the export pipeline.

import { locateInTimeline } from '../model/timeline'
import type { Frame, Timeline } from '../model/types'
import { typingForLine } from '../render/playback'
import type { TokenLine } from '../render/highlighter'

export type RenderOptions = {
  width: number
  height: number
  /** Outer background fill. The literal `'transparent'` clears the canvas
   *  instead of painting, so PNG frames keep their alpha. */
  outerBackground: string
  /** Optional vertical gradient for the outer background. Takes precedence
   *  over `outerBackground` (unless that is `'transparent'`). */
  outerGradient?: { from: string; to: string }
  codeBackground: string
  codeWidth: number
  fontFamily: string
  fontSize: number
  lineHeight: number
  paddingX: number
  paddingY: number
  windowChromeHeight: number
  cornerRadius: number
  /** macOS-style title bar at the top of the code window. */
  showWindowChrome: boolean
  chromeBackground: string
  /** Traffic-light dots, left → right. */
  chromeDotColors: [string, string, string]
  /** Fallback color for tokens without one, and for plain transition text. */
  textColor: string
  cursorColor: string
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
  cornerRadius: 10,
  showWindowChrome: true,
  chromeBackground: '#161b22',
  chromeDotColors: ['#ff5f57', '#febc2e', '#28c840'],
  textColor: '#c9d1d9',
  cursorColor: '#58a6ff',
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
  ctx.fillStyle = opts.chromeBackground
  roundRect(ctx, windowX, windowY, windowW, opts.windowChromeHeight, 0)
  ctx.fill()
  const cy = windowY + opts.windowChromeHeight / 2
  const dots: Array<{ x: number; color: string }> = [
    { x: windowX + 24, color: opts.chromeDotColors[0] },
    { x: windowX + 48, color: opts.chromeDotColors[1] },
    { x: windowX + 72, color: opts.chromeDotColors[2] },
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
  fallbackColor: string,
) {
  let cursor = x
  for (const token of tokens) {
    ctx.fillStyle = token.color ?? fallbackColor
    ctx.fillText(token.content, cursor, y)
    cursor += ctx.measureText(token.content).width
  }
}

export function truncateTokenLine(tokens: TokenLine, chars: number): TokenLine {
  if (chars < 0) return tokens
  const result: TokenLine = []
  let remaining = chars
  for (const token of tokens) {
    if (remaining <= 0) break
    if (token.content.length <= remaining) {
      result.push(token)
      remaining -= token.content.length
    } else {
      result.push({ content: token.content.substring(0, remaining), color: token.color })
      break
    }
  }
  return result
}

export function heightForFrames(
  frames: Frame[],
  opts: Partial<RenderOptions> = {},
): number {
  const o = { ...DEFAULT_RENDER_OPTIONS, ...opts }
  const maxLines = Math.max(1, ...frames.map(f => f.code.split('\n').length))
  const lineGap = o.fontSize * o.lineHeight
  const raw = Math.ceil(
    80 + o.windowChromeHeight + o.paddingY * 2 + maxLines * lineGap,
  )
  // H.264 (mp4 export) only accepts even dimensions; an odd height makes
  // every codec candidate fail isConfigSupported, so the export silently
  // drops to a PNG-only zip. Round up to even. The preview shares this
  // height, so preview and download stay identical.
  return raw + (raw % 2)
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

  // Outer background. `'transparent'` clears to alpha so the exported
  // PNG frames stay transparent (mp4/H.264 can't carry alpha, so its
  // transparent areas fall back to black — that's accepted).
  if (opts.outerBackground === 'transparent') {
    c.clearRect(0, 0, opts.width, opts.height)
  } else if (opts.outerGradient) {
    const grad = c.createLinearGradient(0, 0, 0, opts.height)
    grad.addColorStop(0, opts.outerGradient.from)
    grad.addColorStop(1, opts.outerGradient.to)
    c.fillStyle = grad
    c.fillRect(0, 0, opts.width, opts.height)
  } else {
    c.fillStyle = opts.outerBackground
    c.fillRect(0, 0, opts.width, opts.height)
  }

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
  if (opts.showWindowChrome) {
    drawWindowChrome(c, windowX, windowY, windowW, opts)
  }

  // Code
  c.font = `${opts.fontSize}px ${opts.fontFamily}`
  c.textBaseline = 'top'

  const chromeOffset = opts.showWindowChrome ? opts.windowChromeHeight : 0
  const startX = windowX + opts.paddingX
  const startY = windowY + chromeOffset + opts.paddingY
  const lineGap = opts.fontSize * opts.lineHeight

  const pos = locateInTimeline(inputs.timeline, inputs.elapsedMs)
  const seg = inputs.timeline.segments[pos.segmentIndex]

  if (seg.type === 'hold') {
    const tokens =
      inputs.tokensByFrame.get(seg.frame.id) ??
      seg.frame.code.split('\n').map(line => [{ content: line }])
    for (let i = 0; i < tokens.length; i++) {
      drawTokenLine(c, tokens[i], startX, startY + i * lineGap, opts.textColor)
    }
    c.restore()
    return
  }

  const progress = pos.segmentProgress
  let drawY = 0

  const fromTokens = inputs.tokensByFrame.get(seg.transition.fromFrameId)
  const toTokens = inputs.tokensByFrame.get(seg.transition.toFrameId)

  for (let i = 0; i < seg.transition.lines.length; i++) {
    const role = seg.transition.lines[i]
    const typing = typingForLine(role, progress)
    if (!typing.visible) continue

    let tokenLine: TokenLine | undefined
    if (role.type === 'keep' || role.type === 'add') {
      tokenLine = toTokens?.['toIndex' in role ? role.toIndex : 0]
    } else if (role.type === 'remove') {
      tokenLine = fromTokens?.[role.fromIndex]
    } else if (role.type === 'modify') {
      tokenLine = typing.displayLine
        ? fromTokens?.[role.fromIndex]
        : toTokens?.[role.toIndex]
    }

    const truncated = tokenLine
      ? truncateTokenLine(tokenLine, typing.visibleChars)
      : undefined

    const y = startY + drawY * lineGap

    if (truncated && truncated.length > 0) {
      drawTokenLine(c, truncated, startX, y, opts.textColor)
    } else {
      const lineText = typing.displayLine ?? role.line
      const text =
        typing.visibleChars === -1
          ? lineText
          : lineText.substring(0, typing.visibleChars)
      if (text.length > 0) {
        c.fillStyle = opts.textColor
        c.fillText(text, startX, y)
      }
    }

    if (typing.showCursor) {
      const lineText = typing.displayLine ?? role.line
      const text =
        typing.visibleChars === -1
          ? lineText
          : lineText.substring(0, typing.visibleChars)
      const cursorX = startX + c.measureText(text).width
      c.fillStyle = opts.cursorColor
      c.fillText('|', cursorX, y)
    }
    drawY++
  }
  c.restore()
}
