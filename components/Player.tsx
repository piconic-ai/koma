'use client'

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from '@barefootjs/client'
import { buildTimeline, collapseTransitions } from '../src/model/timeline'
import type { Frame, Spec, Timeline } from '../src/model/types'
import { renderToCanvas, heightForFrames } from '../src/render/canvas'
import { getStageState } from '../src/render/playback'
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

  const highlightedCode = new Map<string, string>()

  const ensureTokens = (frame: Frame, language: Spec['language']) => {
    const prev = highlightedCode.get(frame.id)
    if (prev === `${language}:${frame.code}`) return
    highlightedCode.set(frame.id, `${language}:${frame.code}`)
    const seeded = new Map(tokensByFrame())
    seeded.set(frame.id, plainTokens(frame.code))
    setTokensByFrame(seeded)
    void highlight(frame.code, language).then(tokens => {
      if (highlightedCode.get(frame.id) !== `${language}:${frame.code}`) return
      const next = new Map(tokensByFrame())
      next.set(frame.id, tokens)
      setTokensByFrame(next)
    })
  }

  const renderCanvas = () => {
    if (typeof document === 'undefined') return
    const canvas = document.getElementById('koma-preview-canvas') as HTMLCanvasElement
    if (!canvas) return
    window.dispatchEvent(new CustomEvent('koma:timeupdate', {
      detail: { elapsed: elapsedMs(), total: timeline().totalDurationMs, playing: playing() },
    }))
    renderToCanvas(canvas, {
      timeline: timeline(),
      elapsedMs: elapsedMs(),
      tokensByFrame: tokensByFrame(),
      frames: props.spec.frames,
      options: { height: heightForFrames(props.spec.frames) },
    })
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

    const onSeek = (e: Event) => {
      const ms = (e as CustomEvent).detail.ms
      setPlaying(false)
      setElapsedMs(ms)
      renderCanvas()
    }
    const onPlayToggle = () => togglePlay()
    window.addEventListener('koma:seek', onSeek)
    window.addEventListener('koma:toggleplay', onPlayToggle)
    onCleanup(() => {
      window.removeEventListener('koma:seek', onSeek)
      window.removeEventListener('koma:toggleplay', onPlayToggle)
    })
  })

  createEffect(() => {
    const language = props.spec.language
    const frames = props.spec.frames
    for (const f of frames) {
      void f.code
      ensureTokens(f, language)
    }
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
        setElapsedMs(0)
        lastTs = null
        renderCanvas()
        rafId = requestAnimationFrame(step)
        return
      }
      setElapsedMs(next)
    }
    lastTs = ts
    renderCanvas()
    rafId = requestAnimationFrame(step)
  }

  createEffect(() => {
    const p = playing()
    window.dispatchEvent(new CustomEvent('koma:timeupdate', {
      detail: { elapsed: elapsedMs(), total: timeline().totalDurationMs, playing: p },
    }))
    if (p) {
      lastTs = null
      rafId = requestAnimationFrame(step)
    } else {
      stop()
    }
  })

  let prevSpecKey = ''
  createEffect(() => {
    const key = props.spec.language + ':' + props.spec.frames.length + ':' + props.spec.frames.map(f => f.code).join('\n')
    if (prevSpecKey && key !== prevSpecKey) {
      setPlaying(false)
      setElapsedMs(0)
    }
    prevSpecKey = key
  })

  onCleanup(stop)

  const togglePlay = () => {
    if (elapsedMs() >= timeline().totalDurationMs) setElapsedMs(0)
    setPlaying(p => !p)
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
            borderRadius: '8px',
          }}
        />
      </div>
    </div>
  )
}
