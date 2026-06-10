import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const PlayerSource = readFileSync(resolve(__dirname, 'Player.tsx'), 'utf-8')

describe('Player', () => {
  const result = renderToTest(PlayerSource, 'Player.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is Player', () => {
    expect(result.componentName).toBe('Player')
  })

  // ── Width propagation from spec ───────────────────────

  test('derives canvas width and codeWidth from spec.width', () => {
    expect(PlayerSource).toContain('props.spec.width')
    expect(PlayerSource).toContain('codeWidth: props.spec.width - 180')
  })

  test('omits explicit size when spec has no width', () => {
    expect(PlayerSource).toMatch(/props\.spec\.width\s*\?\s*\{/)
  })

  // ── Reactive re-render on width change ────────────────

  test('re-renders canvas when spec.width changes', () => {
    expect(PlayerSource).toContain('void props.spec.width')
    expect(PlayerSource).toContain('renderCanvas()')
  })

  test('re-renders canvas when spec.theme changes', () => {
    expect(PlayerSource).toContain('void props.spec.theme')
  })

  test('re-renders on expand to repaint the zero-box canvas', () => {
    expect(PlayerSource).toContain('void props.expanded')
  })

  // ── Timeline and playback ─────────────────────────────

  test('builds timeline from spec as a memo', () => {
    expect(result.memos).toContain('timeline')
    expect(PlayerSource).toContain('buildTimeline(props.spec)')
  })

  test('derives stage state from timeline and elapsedMs', () => {
    expect(result.memos).toContain('stage')
    expect(PlayerSource).toContain('getStageState(timeline(), elapsedMs())')
  })

  test('tracks elapsed time and playing state as signals', () => {
    expect(result.signals.some(s => /elapsedMs/i.test(s))).toBe(true)
    expect(result.signals.some(s => /playing/i.test(s))).toBe(true)
  })

  test('dispatches koma:timeupdate events with elapsed, total, and playing', () => {
    expect(PlayerSource).toContain('koma:timeupdate')
    expect(PlayerSource).toContain('elapsed: elapsedMs()')
    expect(PlayerSource).toContain('total: timeline().totalDurationMs')
    expect(PlayerSource).toContain('playing: playing()')
  })

  test('listens for koma:seek to jump to a specific time', () => {
    expect(PlayerSource).toContain('koma:seek')
    expect(PlayerSource).toContain('setElapsedMs(ms)')
  })

  test('listens for koma:toggleplay to toggle playback', () => {
    expect(PlayerSource).toContain('koma:toggleplay')
  })

  // ── Playback stops at the end (no loop) ───────────────

  test('stops playback at the end of the timeline without looping', () => {
    expect(PlayerSource).toContain('if (next >= total)')
    expect(PlayerSource).toContain('setPlaying(false)')
    expect(PlayerSource).toContain('setElapsedMs(total)')
  })

  // ── Reduce motion ─────────────────────────────────────

  test('respects prefers-reduced-motion by collapsing transitions', () => {
    expect(result.signals.some(s => /reduceMotion/i.test(s))).toBe(true)
    expect(PlayerSource).toContain('collapseTransitions(base)')
    expect(PlayerSource).toContain('prefers-reduced-motion: reduce')
  })

  // ── Canvas output ─────────────────────────────────────

  test('renders a canvas element with the expected id', () => {
    expect(PlayerSource).toContain('id="koma-preview-canvas"')
    expect(PlayerSource).toContain('className="koma-canvas"')
  })

  test('renders with an accessible label describing the frame count', () => {
    const player = result.find({ tag: 'div' })
    expect(player).not.toBeNull()
    expect(PlayerSource).toContain('Code animation')
  })

  // ── Spec change resets playback ───────────────────────

  test('resets elapsed time when spec content changes', () => {
    expect(PlayerSource).toContain("key !== prevSpecKey")
    expect(PlayerSource).toContain('setElapsedMs(0)')
  })

  // ── Canvas height accounts for width ──────────────────

  test('canvas height is computed via heightForFrames with merged size options', () => {
    expect(PlayerSource).toContain('heightForFrames(props.spec.frames')
    expect(PlayerSource).toContain('...sizeOpts')
  })
})
