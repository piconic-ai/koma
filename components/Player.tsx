'use client'

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from '@barefootjs/client'
import { Button } from '@/components/ui/button'
import { buildTimeline, collapseTransitions } from '../src/model/timeline'
import type { Frame, Spec, Timeline } from '../src/model/types'
import type { StageState } from '../src/render/playback'
import {
  getStageState,
  typingForLine,
} from '../src/render/playback'
import {
  highlight,
  plainTokens,
  type TokenLine,
} from '../src/render/highlighter'

const PREVIEW_W = 1080
const PREVIEW_H = 1080
const OUTER_BG = '#5da55a'
const CODE_BG = '#0d1117'
const CODE_W = 900
const CHROME_H = 48
const PAD_X = 40
const PAD_Y = 40
const FONT_SIZE = 28
const LINE_HEIGHT = 1.6
const CORNER_R = 16
const FONT = "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace"

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

function renderPreviewCanvas(
  canvas: HTMLCanvasElement,
  stage: StageState,
  tokensByFrame: Map<string, TokenLine[]>,
) {
  if (canvas.width !== PREVIEW_W) canvas.width = PREVIEW_W
  if (canvas.height !== PREVIEW_H) canvas.height = PREVIEW_H

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = OUTER_BG
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)

  const winW = Math.min(CODE_W, PREVIEW_W - 40)
  const winH = PREVIEW_H - 80
  const winX = (PREVIEW_W - winW) / 2
  const winY = (PREVIEW_H - winH) / 2

  ctx.fillStyle = CODE_BG
  roundRect(ctx, winX, winY, winW, winH, CORNER_R)
  ctx.fill()

  ctx.save()
  roundRect(ctx, winX, winY, winW, winH, CORNER_R)
  ctx.clip()

  ctx.fillStyle = '#161b22'
  ctx.fillRect(winX, winY, winW, CHROME_H)
  const dotY = winY + CHROME_H / 2
  const dots = [
    { x: winX + 24, color: '#ff5f57' },
    { x: winX + 48, color: '#febc2e' },
    { x: winX + 72, color: '#28c840' },
  ]
  for (const d of dots) {
    ctx.beginPath()
    ctx.arc(d.x, dotY, 8, 0, Math.PI * 2)
    ctx.fillStyle = d.color
    ctx.fill()
  }

  ctx.font = `${FONT_SIZE}px ${FONT}`
  ctx.textBaseline = 'top'
  const startX = winX + PAD_X
  const startY = winY + CHROME_H + PAD_Y
  const lineGap = FONT_SIZE * LINE_HEIGHT

  if (stage.kind === 'hold') {
    const tokens =
      tokensByFrame.get(stage.frame.id) ??
      stage.frame.code.split('\n').map(line => [{ content: line }])
    for (let i = 0; i < tokens.length; i++) {
      let cursor = startX
      for (const token of tokens[i]) {
        ctx.fillStyle = token.color ?? '#c9d1d9'
        ctx.fillText(token.content, cursor, startY + i * lineGap)
        cursor += ctx.measureText(token.content).width
      }
    }
  } else {
    let drawY = 0
    for (const role of stage.lines) {
      const typing = typingForLine(role, stage.progress)
      if (!typing.visible) continue
      const text =
        typing.visibleChars === -1
          ? role.line
          : role.line.substring(0, typing.visibleChars)
      if (text.length > 0) {
        ctx.fillStyle = '#c9d1d9'
        ctx.fillText(text, startX, startY + drawY * lineGap)
      }
      if (typing.showCursor) {
        const cx = startX + ctx.measureText(text).width
        ctx.fillStyle = '#58a6ff'
        ctx.fillText('|', cx, startY + drawY * lineGap)
      }
      drawY++
    }
  }

  ctx.restore()
}

interface PlayerProps {
  spec: Spec
}

export function Player(props: PlayerProps) {
  const [reduceMotion, setReduceMotion] = createSignal(false)

  const timeline = createMemo<Timeline>(() => {
    const base = buildTimeline(props.spec)
    return reduceMotion() ? collapseTransitions(base) : base
  })

  const [elapsedMs, setElapsedMs] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)

  const [tokensByFrame, setTokensByFrame] = createSignal<Map<string, TokenLine[]>>(
    new Map(),
  )

  const ensureTokens = (frame: Frame, language: Spec['language']) => {
    if (tokensByFrame().has(frame.id)) return
    const seeded = new Map(tokensByFrame())
    seeded.set(frame.id, plainTokens(frame.code))
    setTokensByFrame(seeded)
    void highlight(frame.code, language).then(tokens => {
      const next = new Map(tokensByFrame())
      next.set(frame.id, tokens)
      setTokensByFrame(next)
    })
  }

  let canvasEl: HTMLCanvasElement | null = null

  onMount(() => {
    canvasEl = document.getElementById('koma-preview-canvas') as HTMLCanvasElement

    for (const f of props.spec.frames) ensureTokens(f, props.spec.language)

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReduceMotion(mql.matches)
      const onChange = () => setReduceMotion(mql.matches)
      mql.addEventListener('change', onChange)
      onCleanup(() => mql.removeEventListener('change', onChange))
    }

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepFrame(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepFrame(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  createEffect(() => {
    const language = props.spec.language
    for (const f of props.spec.frames) ensureTokens(f, language)
  })

  const stage = createMemo(() => getStageState(timeline(), elapsedMs()))

  createEffect(() => {
    if (!canvasEl) return
    renderPreviewCanvas(canvasEl, stage(), tokensByFrame())
  })

  let rafId: number | null = null
  let lastTs: number | null = null

  const stop = () => {
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = null
    lastTs = null
  }

  const step = (ts: number) => {
    if (!playing()) {
      stop()
      return
    }
    if (lastTs != null) {
      const total = timeline().totalDurationMs
      const next = elapsedMs() + (ts - lastTs)
      if (next >= total) {
        setElapsedMs(total)
        setPlaying(false)
        stop()
        return
      }
      setElapsedMs(next)
    }
    lastTs = ts
    rafId = requestAnimationFrame(step)
  }

  createEffect(() => {
    if (playing()) {
      lastTs = null
      rafId = requestAnimationFrame(step)
    } else {
      stop()
    }
  })

  createEffect(() => {
    void props.spec.frames.length
    void props.spec.language
    setPlaying(false)
    setElapsedMs(0)
  })

  onCleanup(stop)

  const togglePlay = () => {
    if (elapsedMs() >= timeline().totalDurationMs) setElapsedMs(0)
    setPlaying(p => !p)
  }

  const rewind = () => {
    setPlaying(false)
    setElapsedMs(0)
  }

  const onScrub = (e: Event) => {
    const v = Number((e.currentTarget as HTMLInputElement).value)
    setPlaying(false)
    setElapsedMs(v)
  }

  const stepFrame = (dir: 1 | -1) => {
    const t = timeline()
    const frames = props.spec.frames
    const target = Math.max(
      0,
      Math.min(frames.length - 1, currentFrameIndex() + dir),
    )
    const targetSegIdx = target * 2
    let acc = 0
    for (let i = 0; i < targetSegIdx && i < t.segments.length; i++) {
      acc += t.segments[i].durationMs
    }
    setPlaying(false)
    setElapsedMs(acc)
  }

  const frameCount = createMemo(() => props.spec.frames.length)
  const currentFrameIndex = createMemo(() => {
    const s = stage()
    if (s.kind === 'hold') {
      const idx = props.spec.frames.findIndex(f => f.id === s.frame.id)
      return idx < 0 ? 0 : idx
    }
    let segIdx = 0
    let acc = 0
    const t = timeline()
    for (let i = 0; i < t.segments.length; i++) {
      const seg = t.segments[i]
      if (elapsedMs() < acc + seg.durationMs) {
        segIdx = i
        break
      }
      acc += seg.durationMs
      segIdx = i
    }
    return Math.min(frameCount() - 1, Math.floor((segIdx + 1) / 2))
  })

  return (
    <div
      className="koma-player"
      aria-label={`Code animation, ${props.spec.frames.length} frames`}
    >
      <div className="koma-stage">
        <canvas
          id="koma-preview-canvas"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '12px',
          }}
        />
      </div>
      <div className="koma-controls">
        <Button onClick={togglePlay} size="sm">
          {elapsedMs() >= timeline().totalDurationMs
            ? 'Replay'
            : playing()
              ? 'Pause'
              : 'Play'}
        </Button>
        <Button onClick={rewind} size="sm" variant="ghost">
          Rewind
        </Button>
        <input
          type="range"
          className="koma-scrub"
          min={0}
          max={timeline().totalDurationMs}
          step={16}
          value={String(elapsedMs())}
          onInput={onScrub}
        />
        <span className="koma-counter">
          {currentFrameIndex() + 1}/{frameCount()}
        </span>
      </div>
      <p className="koma-shortcut-hint">
        Space play/pause · ← → step frame
      </p>
    </div>
  )
}
