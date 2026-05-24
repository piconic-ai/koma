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

  const renderCanvas = () => {
    if (typeof document === 'undefined') return
    const canvas = document.getElementById('koma-preview-canvas') as HTMLCanvasElement
    if (!canvas) return
    const s = stage()
    const tokens = tokensByFrame()

    const codeW = 900, chromeH = 48, padX = 40, padY = 40
    const fontSize = 28, lh = 1.6, R = 16
    const font = "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace"
    const maxLines = Math.max(1, ...props.spec.frames.map(f => f.code.split('\n').length))
    const W = 1080
    const H = Math.ceil(80 + chromeH + padY * 2 + maxLines * fontSize * lh)

    if (canvas.width !== W) canvas.width = W
    if (canvas.height !== H) canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#00b769'
    ctx.fillRect(0, 0, W, H)

    const winW = Math.min(codeW, W - 40)
    const winH = H - 80
    const winX = (W - winW) / 2
    const winY = (H - winH) / 2

    ctx.fillStyle = '#0d1117'
    ctx.beginPath()
    ctx.moveTo(winX + R, winY)
    ctx.lineTo(winX + winW - R, winY)
    ctx.quadraticCurveTo(winX + winW, winY, winX + winW, winY + R)
    ctx.lineTo(winX + winW, winY + winH - R)
    ctx.quadraticCurveTo(winX + winW, winY + winH, winX + winW - R, winY + winH)
    ctx.lineTo(winX + R, winY + winH)
    ctx.quadraticCurveTo(winX, winY + winH, winX, winY + winH - R)
    ctx.lineTo(winX, winY + R)
    ctx.quadraticCurveTo(winX, winY, winX + R, winY)
    ctx.closePath()
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(winX + R, winY)
    ctx.lineTo(winX + winW - R, winY)
    ctx.quadraticCurveTo(winX + winW, winY, winX + winW, winY + R)
    ctx.lineTo(winX + winW, winY + winH - R)
    ctx.quadraticCurveTo(winX + winW, winY + winH, winX + winW - R, winY + winH)
    ctx.lineTo(winX + R, winY + winH)
    ctx.quadraticCurveTo(winX, winY + winH, winX, winY + winH - R)
    ctx.lineTo(winX, winY + R)
    ctx.quadraticCurveTo(winX, winY, winX + R, winY)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = '#161b22'
    ctx.fillRect(winX, winY, winW, chromeH)
    const dotY = winY + chromeH / 2
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

    ctx.font = `${fontSize}px ${font}`
    ctx.textBaseline = 'top'
    const startX = winX + padX
    const startY = winY + chromeH + padY
    const step_ = fontSize * lh

    if (s.kind === 'hold') {
      const frameTokens =
        tokens.get(s.frame.id) ??
        s.frame.code.split('\n').map((line: string) => [{ content: line }])
      for (let i = 0; i < frameTokens.length; i++) {
        let cursor = startX
        for (const token of frameTokens[i]) {
          ctx.fillStyle = token.color ?? '#c9d1d9'
          ctx.fillText(token.content, cursor, startY + i * step_)
          cursor += ctx.measureText(token.content).width
        }
      }
    } else {
      let drawY = 0
      for (const role of s.lines) {
        const typing = typingForLine(role, s.progress)
        if (!typing.visible) continue
        const text =
          typing.visibleChars === -1
            ? role.line
            : role.line.substring(0, typing.visibleChars)
        if (text.length > 0) {
          ctx.fillStyle = '#c9d1d9'
          ctx.fillText(text, startX, startY + drawY * step_)
        }
        if (typing.showCursor) {
          const cx = startX + ctx.measureText(text).width
          ctx.fillStyle = '#58a6ff'
          ctx.fillText('|', cx, startY + drawY * step_)
        }
        drawY++
      }
    }

    ctx.restore()
  }

  onMount(() => {
    for (const f of props.spec.frames) ensureTokens(f, props.spec.language)
    renderCanvas()

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
    void stage()
    void tokensByFrame()
    renderCanvas()
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
        renderCanvas()
        return
      }
      setElapsedMs(next)
    }
    lastTs = ts
    renderCanvas()
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
