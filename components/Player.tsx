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
import type { Frame, LineRole, Spec, Timeline } from '../src/model/types'
import {
  getStageState,
  styleForLine,
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
  // `prefers-reduced-motion: reduce` collapses every transition to a
  // hard cut. We re-check via matchMedia rather than baking the answer
  // at SSR time because the server can't observe the user setting.
  const [reduceMotion, setReduceMotion] = createSignal(false)

  const timeline = createMemo<Timeline>(() => {
    const base = buildTimeline(props.spec)
    return reduceMotion() ? collapseTransitions(base) : base
  })

  const [elapsedMs, setElapsedMs] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)

  // Per-frame token cache — fetched lazily but reused once Shiki resolves.
  // Falls back to plain tokens until then.
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

  onMount(() => {
    for (const f of props.spec.frames) ensureTokens(f, props.spec.language)

    // Subscribe to the reduced-motion media query.
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReduceMotion(mql.matches)
      const onChange = () => setReduceMotion(mql.matches)
      mql.addEventListener('change', onChange)
      onCleanup(() => mql.removeEventListener('change', onChange))
    }

    // Keyboard shortcuts: Space toggles play/pause, ←/→ steps frames.
    const onKey = (e: KeyboardEvent) => {
      // Skip if focus is inside an editable element — typing in the
      // textarea shouldn't fire global shortcuts.
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

  // requestAnimationFrame loop driven by `playing`.
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

  // Pause + rewind when the spec changes — a stale timeline mid-play
  // confuses viewers more than the reset does.
  createEffect(() => {
    // Touch the inputs so this effect re-runs on edit.
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

  // Snap elapsed to the start of frame `currentFrameIndex() + dir`.
  // Used by the keyboard arrow shortcuts.
  const stepFrame = (dir: 1 | -1) => {
    const t = timeline()
    const frames = props.spec.frames
    const target = Math.max(
      0,
      Math.min(frames.length - 1, currentFrameIndex() + dir),
    )
    // Sum durations of every segment up to (but not including) the
    // target frame's hold segment. With holds at indices 0, 2, 4, ...
    // the hold for frame `k` starts at segment index `2k`.
    const targetSegIdx = target * 2
    let acc = 0
    for (let i = 0; i < targetSegIdx && i < t.segments.length; i++) {
      acc += t.segments[i].durationMs
    }
    setPlaying(false)
    setElapsedMs(acc)
  }

  const stage = createMemo(() => getStageState(timeline(), elapsedMs()))

  const frameCount = createMemo(() => props.spec.frames.length)
  const currentFrameIndex = createMemo(() => {
    const s = stage()
    if (s.kind === 'hold') {
      const idx = props.spec.frames.findIndex(f => f.id === s.frame.id)
      return idx < 0 ? 0 : idx
    }
    // Mid-transition: credit the destination frame using the segment shape.
    // Segments alternate hold/transition starting with hold, so the
    // destination of transition at segmentIndex `2k+1` is the hold at
    // segmentIndex `2k+2`, which corresponds to frame index `k+1`.
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
        {stage().kind === 'hold' ? (
          <HoldStage
            tokens={
              (() => {
                const s = stage()
                if (s.kind !== 'hold') return plainTokens('')
                return (
                  tokensByFrame().get(s.frame.id) ?? plainTokens(s.frame.code)
                )
              })()
            }
          />
        ) : (
          <TransitionStage
            lines={(stage() as { lines: LineRole[] }).lines}
            progress={(stage() as { progress: number }).progress}
          />
        )}
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

function HoldStage(props: { tokens: TokenLine[] }) {
  return (
    <div className="koma-frame">
      <div className="koma-titlebar">
        <span className="koma-dot koma-dot-red" />
        <span className="koma-dot koma-dot-yellow" />
        <span className="koma-dot koma-dot-green" />
      </div>
      <pre className="koma-code">
        {props.tokens.map((line, i) => (
          <div key={i} className="koma-line">
            {line.length === 0 ? (
              <span key="empty">{' '}</span>
            ) : (
              line.map((token, j) => (
                <span key={j} style={token.color ? { color: token.color } : {}}>
                  {token.content}
                </span>
              ))
            )}
          </div>
        ))}
      </pre>
    </div>
  )
}

function TransitionStage(props: { lines: LineRole[]; progress: number }) {
  return (
    <div className="koma-frame">
      <div className="koma-titlebar">
        <span className="koma-dot koma-dot-red" />
        <span className="koma-dot koma-dot-yellow" />
        <span className="koma-dot koma-dot-green" />
      </div>
      <pre className="koma-code">
        {props.lines.map((role, i) => {
          const style = styleForLine(role, props.progress)
          return (
            <div
              key={i}
              className="koma-line"
              style={{
                opacity: String(style.opacity),
                transform: `translateY(${style.translateY}px)`,
              }}
            >
              <span>{role.line.length === 0 ? ' ' : role.line}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
