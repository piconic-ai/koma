'use client'

import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from '@barefootjs/client'
import { Button } from '@/components/ui/button'
import { buildTimeline } from '../src/model/timeline'
import type { Frame, LineRole, Spec } from '../src/model/types'
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
  const timeline = createMemo(() => buildTimeline(props.spec))

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
