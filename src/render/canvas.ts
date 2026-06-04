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
  /** Optional linear gradient for the outer background. Takes precedence
   *  over `outerBackground` (unless that is `'transparent'`). `angle` is in
   *  CSS degrees (0 = upward, 90 = rightward, 180 = downward); defaults to
   *  180 (top → bottom). Provide `stops` to bias the blend (e.g. hold a
   *  color through the middle so the end color only fills a corner);
   *  otherwise `from`/`to` are placed at 0 and 1. */
  outerGradient?: {
    from: string
    to: string
    angle?: number
    stops?: Array<{ at: number; color: string }>
  }
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
  /** Film-grain intensity over the outer background (0 = none). Adds a
   *  subtle texture so a flat single-color background doesn't read as dead. */
  grainAlpha: number
  /** Peripheral darkening (0 = none, ~0.2 = subtle). Darkens the outer
   *  background toward the corners for depth, leaving the center untouched. */
  vignette: number
  /** Soft drop shadow behind the code window for depth. */
  cardShadow: boolean
  /** Render a left gutter with line numbers. */
  showLineNumbers: boolean
  /** Color of the line-number gutter. */
  lineNumberColor: string
  /** Optional traditional Japanese motif(s) (和柄) tiled faintly over the
   *  outer background, before grain and vignette, for a crafted, textured
   *  feel rather than a flat gradient. An array layers motifs in order (e.g.
   *  waves under scattered gold leaf). Skipped for a `'transparent'`
   *  background. */
  outerPattern?: PatternSpec | PatternSpec[]
  /** Optional hairline border drawn on the code card's edge — e.g. a faint
   *  gold keyline for a lacquered, premium frame. */
  cardBorderColor?: string
  /** Card border width in px (default 1.5). Needs `cardBorderColor`. */
  cardBorderWidth?: number
}

export type PatternSpec = {
  /** Motif: 青海波 (waves), 七宝 (interlocking circles), 桜小紋 (scattered
   *  blossoms), or 砂子 (scattered gold-leaf flecks). */
  kind: 'seigaiha' | 'shippo' | 'sakura' | 'sunago'
  /** Stroke/fill color of the motif. */
  color: string
  /** Motif opacity over the background (default 0.08). */
  opacity?: number
  /** Motif size in px — larger is sparser (default 132). */
  scale?: number
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
  showWindowChrome: false,
  chromeBackground: '#161b22',
  chromeDotColors: ['#ff5f57', '#febc2e', '#28c840'],
  textColor: '#c9d1d9',
  cursorColor: '#58a6ff',
  grainAlpha: 0.11,
  vignette: 0,
  cardShadow: true,
  showLineNumbers: false,
  lineNumberColor: '#6b7280',
}

// A fixed grayscale-noise tile, generated once and reused across frames so
// the grain is static (no flicker between video frames). Returns null in
// environments without a canvas (e.g. unit tests with a stub context).
let noiseTileCache: HTMLCanvasElement | OffscreenCanvas | null | undefined
function getNoiseTile(): HTMLCanvasElement | OffscreenCanvas | null {
  if (noiseTileCache !== undefined) return noiseTileCache
  const size = 160
  let tile: HTMLCanvasElement | OffscreenCanvas | null = null
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement('canvas')
    el.width = size
    el.height = size
    tile = el
  } else if (typeof OffscreenCanvas !== 'undefined') {
    tile = new OffscreenCanvas(size, size)
  }
  if (!tile) {
    noiseTileCache = null
    return null
  }
  const nctx = tile.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!nctx) {
    noiseTileCache = null
    return null
  }
  const img = nctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    // Centered around mid-gray so an `overlay` blend nudges the base color
    // lighter/darker without shifting its hue.
    const v = 128 + Math.round((Math.random() - 0.5) * 90)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  nctx.putImageData(img, 0, 0)
  noiseTileCache = tile
  return tile
}

// A blank tile canvas, or null in environments without a canvas (unit tests).
function createTileCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement('canvas')
    el.width = w
    el.height = h
    return el
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  return null
}

// Draw a five-petal cherry blossom centred at (cx, cy), petals radiating to
// `r`, with a small notch at each petal tip. Path only — caller sets style.
function blossomPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2
    const a1 = a - 0.34
    const a2 = a + 0.34
    // Two control bulges out to a notched tip, back along the next side.
    ctx.moveTo(cx, cy)
    ctx.quadraticCurveTo(
      cx + Math.cos(a1) * r * 0.95, cy + Math.sin(a1) * r * 0.95,
      cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86,
    )
    ctx.quadraticCurveTo(
      cx + Math.cos(a) * r, cy + Math.sin(a) * r,
      cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86,
    )
    ctx.quadraticCurveTo(
      cx + Math.cos(a2) * r * 0.95, cy + Math.sin(a2) * r * 0.95,
      cx, cy,
    )
  }
}

// One tileable repeat of a 和柄 motif, drawn in `color`. Cached per
// kind+color+scale so the (static) pattern is built once and reused across
// every export frame. Returns null where no canvas is available.
const patternTileCache = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>()
function getPatternTile(
  kind: PatternSpec['kind'],
  color: string,
  scale: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  const key = `${kind}|${color}|${scale}`
  const cached = patternTileCache.get(key)
  if (cached !== undefined) return cached

  // Tile dimensions per motif so a plain `repeat` lines up seamlessly.
  const tw = kind === 'seigaiha' ? scale : scale
  const th = kind === 'seigaiha' ? scale : scale
  const tile = createTileCanvas(tw, th)
  if (!tile) {
    patternTileCache.set(key, null)
    return null
  }
  const ctx = tile.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) {
    patternTileCache.set(key, null)
    return null
  }

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (kind === 'seigaiha') {
    // 青海波 — fans of concentric arcs, rows overlapping and offset by half
    // a step. Draw a neighbourhood so arcs crossing the tile edge wrap.
    const R = scale * 0.62
    const sx = scale
    const sy = scale * 0.5
    const rings = [1, 0.74, 0.48, 0.22]
    ctx.lineWidth = Math.max(1.4, scale * 0.016)
    for (let row = -2; row <= 3; row++) {
      const offset = (row & 1) ? sx / 2 : 0
      const cy = row * sy
      for (let col = -2; col <= 3; col++) {
        const cx = col * sx + offset
        for (const f of rings) {
          ctx.beginPath()
          ctx.arc(cx, cy, R * f, Math.PI, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
  } else if (kind === 'shippo') {
    // 七宝 — interlocking circles on a grid plus its half-offset, their
    // overlaps forming the four-petal lens. r = half-diagonal so circles
    // pass through neighbouring centres.
    const d = scale
    const r = (d / 2) * Math.SQRT2
    ctx.lineWidth = Math.max(1.3, scale * 0.014)
    const centres: Array<[number, number]> = []
    for (let i = -1; i <= 2; i++)
      for (let j = -1; j <= 2; j++) {
        centres.push([i * d, j * d])
        centres.push([i * d + d / 2, j * d + d / 2])
      }
    for (const [cx, cy] of centres) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (kind === 'sunago') {
    // 砂子 — scattered gold-leaf flecks (as on Kanazawa washi/lacquer): mostly
    // fine dust with a few larger flakes, placed deterministically so the
    // grain is static across frames. Per-fleck alpha varies for depth.
    let seed = 0x9e3779b9 ^ Math.round(scale)
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
    const count = Math.max(18, Math.round((scale * scale) / 520))
    for (let i = 0; i < count; i++) {
      const x = rnd() * scale
      const y = rnd() * scale
      const big = rnd() > 0.86
      ctx.globalAlpha = big ? 0.55 + rnd() * 0.35 : 0.18 + rnd() * 0.4
      if (big) {
        // A tiny angular flake of gold leaf.
        const s = scale * (0.016 + rnd() * 0.018)
        ctx.beginPath()
        ctx.moveTo(x, y - s)
        ctx.lineTo(x + s * 0.8, y)
        ctx.lineTo(x, y + s)
        ctx.lineTo(x - s * 0.7, y + s * 0.2)
        ctx.closePath()
        ctx.fill()
      } else {
        const r = scale * (0.004 + rnd() * 0.007)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  } else {
    // 桜小紋 — scattered blossoms: a larger one centred, smaller ones at the
    // corners (offset grid) so the field reads dense but irregular.
    blossomPath(ctx, scale / 2, scale / 2, scale * 0.2)
    ctx.fill()
    for (const [cx, cy] of [[0, 0], [scale, 0], [0, scale], [scale, scale]] as const) {
      blossomPath(ctx, cx, cy, scale * 0.13)
      ctx.fill()
    }
  }

  patternTileCache.set(key, tile)
  return tile
}

// Endpoints of a gradient line across a w×h box for a CSS-style angle
// (0 = up, 90 = right, 180 = down), sized so it spans the whole box.
function gradientLine(w: number, h: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))
  const cx = w / 2
  const cy = h / 2
  return {
    x0: cx - (dx * len) / 2,
    y0: cy - (dy * len) / 2,
    x1: cx + (dx * len) / 2,
    y1: cy + (dy * len) / 2,
  }
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
  const r = 10
  const gap = 8
  const firstX = windowX + 16 + r
  const dots: Array<{ x: number; color: string }> = [
    { x: firstX, color: opts.chromeDotColors[0] },
    { x: firstX + (r * 2 + gap), color: opts.chromeDotColors[1] },
    { x: firstX + (r * 2 + gap) * 2, color: opts.chromeDotColors[2] },
  ]
  for (const dot of dots) {
    ctx.beginPath()
    ctx.arc(dot.x, cy, r, 0, Math.PI * 2)
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

// Draw a right-aligned line number in the gutter, then restore left align
// so the code text (which is left-aligned) is unaffected.
function drawLineNumber(
  ctx: CanvasRenderingContext2D,
  n: number,
  rightX: number,
  y: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.textAlign = 'right'
  ctx.fillText(String(n), rightX, y)
  ctx.textAlign = 'left'
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
  const chromeH = o.showWindowChrome ? o.windowChromeHeight : 0
  const raw = Math.ceil(
    80 + chromeH + o.paddingY * 2 + maxLines * lineGap,
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
    const { x0, y0, x1, y1 } = gradientLine(
      opts.width,
      opts.height,
      opts.outerGradient.angle ?? 180,
    )
    const grad = c.createLinearGradient(x0, y0, x1, y1)
    const stops = opts.outerGradient.stops ?? [
      { at: 0, color: opts.outerGradient.from },
      { at: 1, color: opts.outerGradient.to },
    ]
    for (const s of stops) grad.addColorStop(s.at, s.color)
    c.fillStyle = grad
    c.fillRect(0, 0, opts.width, opts.height)
  } else {
    c.fillStyle = opts.outerBackground
    c.fillRect(0, 0, opts.width, opts.height)
  }

  // 和柄 — a faint traditional motif tiled over the background, before grain
  // and vignette so both texture and depth sit on top of it. Skipped for a
  // transparent background and where no canvas is available (unit tests).
  if (
    opts.outerPattern &&
    opts.outerBackground !== 'transparent' &&
    typeof c.createPattern === 'function'
  ) {
    const layers = Array.isArray(opts.outerPattern) ? opts.outerPattern : [opts.outerPattern]
    for (const { kind, color, opacity = 0.08, scale = 132 } of layers) {
      const tile = getPatternTile(kind, color, scale)
      if (!tile) continue
      const pattern = c.createPattern(tile as CanvasImageSource, 'repeat')
      if (pattern) {
        c.save()
        c.globalAlpha = opacity
        c.fillStyle = pattern
        c.fillRect(0, 0, opts.width, opts.height)
        c.restore()
      }
    }
  }

  // Film grain over the background — drawn before the code window so it only
  // textures the outer area. Skipped for transparent backgrounds and in
  // environments without a real canvas (unit tests).
  if (
    opts.grainAlpha > 0 &&
    opts.outerBackground !== 'transparent' &&
    typeof c.createPattern === 'function'
  ) {
    const tile = getNoiseTile()
    if (tile) {
      const pattern = c.createPattern(tile as CanvasImageSource, 'repeat')
      if (pattern) {
        c.save()
        c.globalAlpha = opts.grainAlpha
        c.globalCompositeOperation = 'overlay'
        c.fillStyle = pattern
        c.fillRect(0, 0, opts.width, opts.height)
        c.restore()
      }
    }
  }

  // Vignette — gently darken the corners, center untouched. Adds depth
  // without changing the background's color or gradient.
  if (
    opts.vignette > 0 &&
    opts.outerBackground !== 'transparent' &&
    typeof c.createRadialGradient === 'function'
  ) {
    const cx = opts.width / 2
    const cy = opts.height / 2
    const outer = Math.hypot(cx, cy)
    const vg = c.createRadialGradient(cx, cy, outer * 0.55, cx, cy, outer)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, `rgba(0,0,0,${opts.vignette})`)
    c.fillStyle = vg
    c.fillRect(0, 0, opts.width, opts.height)
  }

  // Code window — centered, fixed width
  const windowW = Math.min(opts.codeWidth, opts.width - 40)
  const windowH = opts.height - 80
  const windowX = (opts.width - windowW) / 2
  const windowY = (opts.height - windowH) / 2

  // Draw rounded-rect code background, with a soft drop shadow for depth.
  c.save()
  if (opts.cardShadow) {
    // Softer, more diffuse float: larger blur, gentle downward offset.
    c.shadowColor = 'rgba(0, 0, 0, 0.24)'
    c.shadowBlur = Math.round(opts.width * 0.05)
    c.shadowOffsetY = Math.round(opts.width * 0.02)
  }
  c.fillStyle = opts.codeBackground
  roundRect(c, windowX, windowY, windowW, windowH, opts.cornerRadius)
  c.fill()
  c.restore()

  // Optional hairline keyline on the card edge (e.g. a faint gold frame).
  if (opts.cardBorderColor) {
    c.save()
    c.strokeStyle = opts.cardBorderColor
    c.lineWidth = opts.cardBorderWidth ?? 1.5
    roundRect(c, windowX, windowY, windowW, windowH, opts.cornerRadius)
    c.stroke()
    c.restore()
  }

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

  // Optional line-number gutter. Width is derived from the largest line
  // count across all frames so the code's left edge stays put frame to
  // frame (no jiggle as the line count changes).
  let codeStartX = startX
  let gutterRightX = startX
  if (opts.showLineNumbers) {
    const maxLines = Math.max(1, ...inputs.frames.map(f => f.code.split('\n').length))
    const digitsW = c.measureText('9'.repeat(String(maxLines).length)).width
    const gap = opts.fontSize * 1.2
    gutterRightX = startX + digitsW
    codeStartX = startX + digitsW + gap
  }

  const pos = locateInTimeline(inputs.timeline, inputs.elapsedMs)
  const seg = inputs.timeline.segments[pos.segmentIndex]

  if (seg.type === 'hold') {
    const tokens =
      inputs.tokensByFrame.get(seg.frame.id) ??
      seg.frame.code.split('\n').map(line => [{ content: line }])
    for (let i = 0; i < tokens.length; i++) {
      const y = startY + i * lineGap
      if (opts.showLineNumbers) drawLineNumber(c, i + 1, gutterRightX, y, opts.lineNumberColor)
      drawTokenLine(c, tokens[i], codeStartX, y, opts.textColor)
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

    if (opts.showLineNumbers) {
      drawLineNumber(c, drawY + 1, gutterRightX, y, opts.lineNumberColor)
    }

    if (truncated && truncated.length > 0) {
      drawTokenLine(c, truncated, codeStartX, y, opts.textColor)
    } else {
      const lineText = typing.displayLine ?? role.line
      const text =
        typing.visibleChars === -1
          ? lineText
          : lineText.substring(0, typing.visibleChars)
      if (text.length > 0) {
        c.fillStyle = opts.textColor
        c.fillText(text, codeStartX, y)
      }
    }

    if (typing.showCursor) {
      const lineText = typing.displayLine ?? role.line
      const text =
        typing.visibleChars === -1
          ? lineText
          : lineText.substring(0, typing.visibleChars)
      const cursorX = codeStartX + c.measureText(text).width
      c.fillStyle = opts.cursorColor
      c.fillText('|', cursorX, y)
    }
    drawY++
  }
  c.restore()
}
