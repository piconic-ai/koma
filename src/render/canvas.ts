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
  /** Optional organic gold-leaf clouds (金雲) drawn in the corners — an
   *  irregular, hand-strewn drift of gold with 砂子 flecks trailing inward,
   *  not a regular tiled motif. Drawn over grain/vignette so the gold stays
   *  vivid. Skipped for a `'transparent'` background. */
  outerGold?: GoldSpec
  /** Optional single dry-brush gold stroke (金の刷毛) swept across the
   *  background — gold carried as a kasure (broken-ink) line, not a filled
   *  area. Drawn over grain/vignette so it stays vivid. Skipped for a
   *  `'transparent'` background. */
  goldBrush?: GoldBrushSpec
  /** Optional washi (和紙) paper texture — fine fibres and specks — tiled over
   *  the outer background and the code card, for a hand-made paper feel beyond
   *  flat grain. Skipped for a `'transparent'` background. */
  washi?: WashiSpec
}

export type GoldBrushSpec = {
  /** Gold color. */
  color: string
  /** Stroke start, as fractions of the canvas (can sit slightly off-canvas). */
  from: [number, number]
  /** Stroke end, as fractions of the canvas. */
  to: [number, number]
  /** Brush width in px (default min(w,h) × 0.06). */
  width?: number
  /** Overall opacity (default 0.5). */
  opacity?: number
  /** Perpendicular bow as a fraction of length, for an organic curve (default 0.05). */
  curve?: number
  /** Seed so the (static) kasure breakup is stable across frames (default 1). */
  seed?: number
}

export type WashiSpec = {
  /** Fibre/speck colour (a light, warm tone reads as paper on a dark ground). */
  color: string
  /** Strength over the outer background (default 0.5). */
  alpha?: number
  /** Strength over the code card (default `alpha` × 0.6 — subtler so code
   *  stays legible). */
  cardAlpha?: number
  /** Tile size in px — larger repeats less visibly (default 300). */
  scale?: number
}

export type GoldSpec = {
  /** Gold color. */
  color: string
  /** Which corners to anchor clouds in. */
  corners: Array<'tl' | 'tr' | 'bl' | 'br'>
  /** Overall strength multiplier (default 1). */
  intensity?: number
  /** Cloud reach as a fraction of min(width,height) (default 0.6). */
  scale?: number
  /** Seed so the (static) scatter is stable across frames (default 1). */
  seed?: number
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// A full-canvas gold-leaf layer (金雲 + 砂子), built once and cached so the
// scatter is static and cheap across export frames. Each corner gets an
// organic drift of soft gold stamps — dense near the corner, with an irregular
// torn edge — and a tail of fine flecks reaching inward. Returns null where no
// canvas / radial gradients are available (unit tests).
const goldLayerCache = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>()
function getGoldLayer(w: number, h: number, g: GoldSpec): HTMLCanvasElement | OffscreenCanvas | null {
  const intensity = g.intensity ?? 1
  const scale = g.scale ?? 0.6
  const seed0 = g.seed ?? 1
  const key = `${w}x${h}|${g.color}|${g.corners.join('')}|${scale}|${intensity}|${seed0}`
  const cached = goldLayerCache.get(key)
  if (cached !== undefined) return cached

  const layer = createTileCanvas(w, h)
  const ctx = layer?.getContext('2d') as CanvasRenderingContext2D | null
  if (!layer || !ctx || typeof ctx.createRadialGradient !== 'function') {
    goldLayerCache.set(key, null)
    return null
  }

  const { r, g: gg, b } = hexToRgb(g.color)
  const rgba = (a: number) => `rgba(${r},${gg},${b},${a})`
  // A lighter cast of the gold for the brightest glints (leaf catching light).
  const lift = (v: number) => Math.round(v + (255 - v) * 0.45)
  const highlight = `rgb(${lift(r)},${lift(gg)},${lift(b)})`
  const reach = Math.min(w, h) * scale

  for (const corner of g.corners) {
    const ox = corner[1] === 'l' ? 0 : w
    const oy = corner[0] === 't' ? 0 : h
    const sx = corner[1] === 'l' ? 1 : -1
    const sy = corner[0] === 't' ? 1 : -1
    let seed = (seed0 * 2654435761) ^ (ox * 73856093) ^ (oy * 19349663)
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
    // Per-corner irregular boundary: a few summed waves modulate the reach.
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28]
    const edge = (ang: number) =>
      0.6 + 0.22 * Math.sin(ang * 2 + ph[0]) + 0.13 * Math.sin(ang * 5 + ph[1]) + 0.08 * Math.sin(ang * 9 + ph[2])

    // Soft gold stamps — the cloud body, dense → sparse with a torn edge.
    const stamps = 120
    for (let i = 0; i < stamps; i++) {
      const ang = rnd() * (Math.PI / 2)
      const t = Math.pow(rnd(), 1.7)
      const dist = t * reach * edge(ang)
      const px = ox + sx * Math.cos(ang) * dist + (rnd() - 0.5) * reach * 0.05
      const py = oy + sy * Math.sin(ang) * dist + (rnd() - 0.5) * reach * 0.05
      const rad = ((1 - t) * 0.18 + 0.03) * reach * (0.5 + rnd())
      const a = intensity * (0.05 + 0.16 * (1 - t)) * (0.55 + 0.45 * rnd())
      const grad = ctx.createRadialGradient(px, py, 0, px, py, Math.max(2, rad))
      grad.addColorStop(0, rgba(a))
      grad.addColorStop(1, rgba(0))
      ctx.fillStyle = grad
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2)
    }

    // 砂子 — fine flecks (plus a few angular flakes) trailing further inward,
    // thinning with distance so the gold dissolves into the dark.
    const flecks = 320
    for (let i = 0; i < flecks; i++) {
      const ang = rnd() * (Math.PI / 2)
      const t = Math.pow(rnd(), 1.4)
      const dist = t * reach * 1.7 * edge(ang)
      const px = ox + sx * Math.cos(ang) * dist + (rnd() - 0.5) * 24
      const py = oy + sy * Math.sin(ang) * dist + (rnd() - 0.5) * 24
      const big = rnd() > 0.9
      // A few near-corner flecks glint brightly, like leaf catching light, so
      // the gold reads as vivid metal rather than a dull wash.
      const glint = !big && t < 0.5 && rnd() > 0.9
      ctx.globalAlpha = glint
        ? Math.min(1, intensity * (1.5 + rnd()))
        : intensity * (big ? 0.6 : 0.42) * (1 - t * 0.7) * (0.5 + 0.5 * rnd())
      ctx.fillStyle = glint ? highlight : g.color
      if (big) {
        const s = 2 + rnd() * 3
        ctx.beginPath()
        ctx.moveTo(px, py - s)
        ctx.lineTo(px + s * 0.8, py)
        ctx.lineTo(px, py + s)
        ctx.lineTo(px - s * 0.7, py + s * 0.2)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(px, py, (glint ? 0.5 : 0.6) + rnd() * 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  goldLayerCache.set(key, layer)
  return layer
}

// A full-canvas layer with a single dry-brush gold stroke (金の刷毛): many fine
// bristle streaks along a gently bowed path, broken up (kasure) and tapered at
// the ends, with the odd bright glint. Built once and cached. Returns null
// where no canvas is available (unit tests).
const goldBrushCache = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>()
function getGoldBrushLayer(w: number, h: number, g: GoldBrushSpec): HTMLCanvasElement | OffscreenCanvas | null {
  const opacity = g.opacity ?? 0.5
  const curve = g.curve ?? 0.05
  const seed0 = g.seed ?? 1
  const width = g.width ?? Math.min(w, h) * 0.06
  const key = `${w}x${h}|${g.color}|${g.from.join(',')}|${g.to.join(',')}|${width}|${opacity}|${curve}|${seed0}`
  const cached = goldBrushCache.get(key)
  if (cached !== undefined) return cached

  const layer = createTileCanvas(w, h)
  const ctx = layer?.getContext('2d') as CanvasRenderingContext2D | null
  if (!layer || !ctx) {
    goldBrushCache.set(key, null)
    return null
  }

  const { r, g: gg, b } = hexToRgb(g.color)
  const lift = (v: number) => Math.round(v + (255 - v) * 0.5)

  const x0 = g.from[0] * w, y0 = g.from[1] * h
  const x1 = g.to[0] * w, y1 = g.to[1] * h
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len // unit perpendicular
  const cx = (x0 + x1) / 2 + nx * curve * len
  const cy = (y0 + y1) / 2 + ny * curve * len
  const pointAt = (t: number): [number, number] => {
    const mt = 1 - t
    return [mt * mt * x0 + 2 * mt * t * cx + t * t * x1, mt * mt * y0 + 2 * mt * t * cy + t * t * y1]
  }

  let seed = (seed0 * 2654435761) >>> 0
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }

  // 2-D value noise (a few octaves) — the "paper tooth". A dry brush deposits
  // ink on the high points of this field and skips the low points, which is
  // what gives kasure its organic, non-repeating mottle. No periodic wave.
  const hash2 = (ix: number, iy: number, s: number) => {
    let h = (ix * 374761393 + iy * 668265263 + s * 2246822519) >>> 0
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff
  }
  const noise2 = (x: number, y: number, s: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = hash2(xi, yi, s), bb = hash2(xi + 1, yi, s)
    const c = hash2(xi, yi + 1, s), dd = hash2(xi + 1, yi + 1, s)
    return (a * (1 - u) + bb * u) * (1 - v) + (c * (1 - u) + dd * u) * v
  }
  const fbm2 = (x: number, y: number, s: number) =>
    0.6 * noise2(x, y, s) + 0.27 * noise2(x * 2.1, y * 2.1, s + 17) + 0.13 * noise2(x * 4.3, y * 4.3, s + 41)
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }
  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

  // Dry brush is a textured *area*, not a bundle of lines, so we paint into a
  // pixel buffer: march the band (along × across) and deposit gold wherever the
  // paper-tooth noise beats an ink threshold that climbs toward the tip.
  if (typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function') {
    goldBrushCache.set(key, null)
    return null
  }
  const img = ctx.createImageData(w, h)
  const data = img.data
  const halfW = width / 2
  // A flat brush lays down a *textured mass* of ink: hairs (suji) streak along
  // the drag direction, but the coverage is continuous, not a set of discrete
  // lines. We build a coverage field — directional streaks + finer grain — and
  // map it to alpha with a SOFT response, so thin spots go translucent (the
  // ground shows through) rather than snapping on/off into bars or wires.
  const acrossScale = Math.max(5, width / 3.5)
  const alongScale = Math.max(2, len / 90)
  const seedA = Math.floor(rnd() * 100000)
  const seedB = Math.floor(rnd() * 100000)
  const seedW = Math.floor(rnd() * 100000)

  const sSteps = Math.ceil(len)
  for (let si = 0; si <= sSteps; si++) {
    const t = si / sSteps
    const [pcx, pcy] = pointAt(t)
    // Width wavers along the length and tapers at both ends.
    const ends = smooth(0, 0.05, t) * smooth(0, 0.1, 1 - t)
    const hw = halfW * (0.7 + 0.5 * fbm2(t * alongScale * 0.5, 7, seedW)) * (0.3 + 0.7 * ends)
    if (hw < 0.5) continue
    // The "dry" level rises toward the tip: as ink runs out, only the densest
    // streaks survive, so the mass frays into fine suji.
    const dry = 0.26 + 0.4 * smooth(0.1, 1.15, t)
    const dSteps = Math.ceil(hw * 2)
    for (let di = 0; di <= dSteps; di++) {
      const dn = (di / dSteps) * 2 - 1 // -1..1 across the band
      const d = dn * hw
      // Directional streaks (vary across, drift slowly along) + finer grain
      // that breaks them up so they read as bristle texture, not wires.
      const streak = fbm2(t * alongScale * 0.35, dn * acrossScale, seedA)
      const grain = fbm2(t * alongScale * 1.3 + 5, dn * acrossScale * 1.7 + 9, seedB)
      const edge = 1 - 0.5 * dn * dn
      const cov = (0.6 * streak + 0.4 * grain) * edge
      // Soft ink response: bare below `dry`, opaque a little above it, graded
      // between — a textured mass with translucent thin spots and holes.
      const a = smooth(dry, dry + 0.34, cov) * ends * opacity
      if (a <= 0.01) continue
      const px = Math.round(pcx + nx * d)
      const py = Math.round(pcy + ny * d)
      if (px < 0 || px >= w || py < 0 || py >= h) continue
      // A faint glint only on the densest streaks — never a glossy fill.
      const glint = clamp01((cov - 0.82) * 3) * 0.5
      const idx = (py * w + px) * 4
      const na = a * 255
      if (na > data[idx + 3]) {
        data[idx] = Math.round(r + (lift(r) - r) * glint)
        data[idx + 1] = Math.round(gg + (lift(gg) - gg) * glint)
        data[idx + 2] = Math.round(b + (lift(b) - b) * glint)
        data[idx + 3] = na
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  goldBrushCache.set(key, layer)
  return layer
}

// One tileable repeat of a washi (和紙) paper texture: scattered fine fibres
// (short, faintly curved strokes) plus light/dark specks, on transparent so it
// can be laid over any surface. Cached per colour+size. Returns null where no
// canvas is available (unit tests).
const washiTileCache = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>()
function getWashiTile(color: string, scale: number): HTMLCanvasElement | OffscreenCanvas | null {
  const key = `${color}|${scale}`
  const cached = washiTileCache.get(key)
  if (cached !== undefined) return cached
  const tile = createTileCanvas(scale, scale)
  const ctx = tile?.getContext('2d') as CanvasRenderingContext2D | null
  if (!tile || !ctx) {
    washiTileCache.set(key, null)
    return null
  }
  const { r, g, b } = hexToRgb(color)
  let seed = 0x6d2b79f5 ^ Math.round(scale)
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
  ctx.lineCap = 'round'

  // Fibres — the defining washi texture.
  const fibres = Math.max(60, Math.round((scale * scale) / 620))
  for (let i = 0; i < fibres; i++) {
    const x = rnd() * scale
    const y = rnd() * scale
    const ang = rnd() * Math.PI
    const len = scale * (0.025 + rnd() * 0.1)
    const a = 0.04 + rnd() * 0.12
    const x2 = x + Math.cos(ang) * len
    const y2 = y + Math.sin(ang) * len
    const mx = (x + x2) / 2 + (rnd() - 0.5) * 5
    const my = (y + y2) / 2 + (rnd() - 0.5) * 5
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
    ctx.lineWidth = 0.5 + rnd() * 0.9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(mx, my, x2, y2)
    ctx.stroke()
  }
  // Specks — a little lint (light) and dust (dark).
  const specks = Math.max(24, Math.round((scale * scale) / 1300))
  for (let i = 0; i < specks; i++) {
    const x = rnd() * scale
    const y = rnd() * scale
    const dark = rnd() > 0.62
    const a = 0.05 + rnd() * 0.12
    ctx.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(${r},${g},${b},${a})`
    ctx.beginPath()
    ctx.arc(x, y, 0.5 + rnd() * 1.1, 0, Math.PI * 2)
    ctx.fill()
  }
  washiTileCache.set(key, tile)
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

  // Washi paper texture over the outer ground — fibres + specks for a
  // hand-made paper feel. Drawn before the vignette so it darkens with depth.
  if (
    opts.washi &&
    opts.outerBackground !== 'transparent' &&
    typeof c.createPattern === 'function'
  ) {
    const tile = getWashiTile(opts.washi.color, opts.washi.scale ?? 300)
    if (tile) {
      const pattern = c.createPattern(tile as CanvasImageSource, 'repeat')
      if (pattern) {
        c.save()
        c.globalAlpha = opts.washi.alpha ?? 0.5
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

  // 金雲 — organic gold-leaf clouds, drawn over the vignette so the gold stays
  // vivid in the corners. Built once into a cached layer and stamped here.
  if (
    opts.outerGold &&
    opts.outerBackground !== 'transparent' &&
    typeof c.drawImage === 'function'
  ) {
    const layer = getGoldLayer(opts.width, opts.height, opts.outerGold)
    if (layer) c.drawImage(layer as CanvasImageSource, 0, 0)
  }

  // 金の刷毛 — a single dry-brush gold stroke, also over the vignette.
  if (
    opts.goldBrush &&
    opts.outerBackground !== 'transparent' &&
    typeof c.drawImage === 'function'
  ) {
    const layer = getGoldBrushLayer(opts.width, opts.height, opts.goldBrush)
    if (layer) c.drawImage(layer as CanvasImageSource, 0, 0)
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

  // Washi texture over the card surface too (subtler), so the code sits on
  // paper rather than a flat fill.
  if (opts.washi && typeof c.createPattern === 'function') {
    const tile = getWashiTile(opts.washi.color, opts.washi.scale ?? 300)
    if (tile) {
      const pattern = c.createPattern(tile as CanvasImageSource, 'repeat')
      if (pattern) {
        c.save()
        c.globalAlpha = opts.washi.cardAlpha ?? (opts.washi.alpha ?? 0.5) * 0.6
        c.fillStyle = pattern
        c.fillRect(windowX, windowY, windowW, windowH)
        c.restore()
      }
    }
  }

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
