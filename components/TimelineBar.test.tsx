import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const TimelineBarSource = readFileSync(resolve(__dirname, 'TimelineBar.tsx'), 'utf-8')

describe('TimelineBar', () => {
  const result = renderToTest(TimelineBarSource, 'TimelineBar.tsx')

  const byClass = (cls: string) =>
    result.findAll({ tag: 'div' }).filter(n => n.classes.includes(cls))

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is TimelineBar', () => {
    expect(result.componentName).toBe('TimelineBar')
  })

  // ── Hold segments ─────────────────────────────────────

  test('renders a hold segment for each frame', () => {
    expect(TimelineBarSource).toContain('koma-timeline-segment')
    expect(result.find({ tag: 'span' })).not.toBeNull()
  })

  // ── Transition segments ───────────────────────────────

  test('renders a transition segment between frames', () => {
    const transitions = byClass('koma-timeline-transition')
    expect(transitions.length).toBeGreaterThanOrEqual(1)
  })

  test('transition segment carries a resize handle hook and a grip', () => {
    expect(TimelineBarSource).toContain('data-trans-handle')
    const grips = result.findAll({ tag: 'span' }).filter(n =>
      n.classes.includes('koma-timeline-transition-grip'),
    )
    expect(grips.length).toBeGreaterThanOrEqual(1)
  })

  test('transition width is driven by its share of the total', () => {
    expect(TimelineBarSource).toContain('transBasisPct(i)')
    expect(TimelineBarSource).toMatch(/transBasisPct\s*=\s*\(i: number\)/)
  })

  test('hold width is a share of the grand total (holds + transitions)', () => {
    expect(TimelineBarSource).toContain('holdBasisPct(i)')
    expect(TimelineBarSource).toContain('computeTotalMs(props.frames)')
  })

  // ── Segment handle drag (hold redistribution) ────────

  test('resizing a transition is wired to onTransitionLayout via computeTransitionDragPx', () => {
    expect(TimelineBarSource).toContain('onTransitionLayout')
    expect(TimelineBarSource).toContain('computeTransitionDragPx')
    expect(TimelineBarSource).toMatch(/msPerPx\s*=\s*barWidth > 0/)
  })

  test('keeps the existing per-frame hold redistribution handle', () => {
    expect(byClass('koma-timeline-handle-bar').length).toBeGreaterThanOrEqual(1)
    expect(TimelineBarSource).toContain('computeSegmentDrag')
  })

  // ── Playhead and seek ─────────────────────────────────

  test('playhead and seek use the linear bar mapping', () => {
    expect(TimelineBarSource).toContain('elapsedToPlayheadPct')
    expect(TimelineBarSource).toContain('barRatioToElapsed')
    expect(TimelineBarSource).not.toContain('holdRatioToElapsed')
  })

  // ── Bar width and duration relationship ───────────────

  test('bar width percentage is derived from computeBarWidthPct(frames)', () => {
    expect(TimelineBarSource).toContain('computeBarWidthPct(props.frames)')
    expect(TimelineBarSource).toContain('barWidthPct()')
  })

  test('bar CSS width is bound to barWidthPct via barStyle', () => {
    expect(TimelineBarSource).toMatch(/barStyle\s*=\s*\(\)\s*=>\s*`width:\$\{barWidthPct\(\)\}%`/)
  })

  test('total duration is derived from computeTotalMs(frames)', () => {
    expect(TimelineBarSource).toContain('computeTotalMs(props.frames)')
    expect(TimelineBarSource).toContain('totalDuration()')
  })

  test('formats total duration in the timeline label', () => {
    expect(TimelineBarSource).toContain('formatDuration(totalDuration())')
    const totalLabel = result.findAll({ tag: 'span' }).find(n =>
      n.classes.includes('koma-timeline-total'),
    )
    expect(totalLabel).not.toBeUndefined()
  })

  // ── Edge drag (bar resize → playback duration) ────────

  test('renders an edge drag handle for bar resize', () => {
    expect(TimelineBarSource).toContain('data-timeline-edge')
    expect(TimelineBarSource).toContain('koma-timeline-edge')
  })

  test('tracks edge drag state in edgeDragging signal', () => {
    expect(result.signals.some(s => /edgeDragging/i.test(s))).toBe(true)
    expect(TimelineBarSource).toContain('setEdgeDragging(true)')
    expect(TimelineBarSource).toContain('setEdgeDragging(false)')
  })

  test('edge drag applies a dragging CSS modifier', () => {
    expect(TimelineBarSource).toContain('koma-timeline-edge--dragging')
  })

  test('edge drag scales all holds proportionally while respecting MIN_HOLD', () => {
    expect(TimelineBarSource).toContain('Math.max(MIN_HOLD, Math.round(start.startHolds[i] * scale))')
  })

  test('edge drag reports atMin when all holds hit the floor', () => {
    expect(result.signals.some(s => /atMin/i.test(s))).toBe(true)
    expect(TimelineBarSource).toContain('setAtMin(allAtMin)')
  })

  test('atMin state applies the --at-min CSS modifier on the bar', () => {
    expect(TimelineBarSource).toContain('koma-timeline--at-min')
  })

  test('edge drag auto-scrolls the container when the cursor nears the right edge', () => {
    expect(TimelineBarSource).toContain('SCROLL_ZONE')
    expect(TimelineBarSource).toContain('SCROLL_SPEED')
    expect(TimelineBarSource).toContain('scrollContainer.scrollLeft')
  })

  // ── Playhead drag state ───────────────────────────────

  test('tracks playhead drag state in isDragging signal', () => {
    expect(result.signals.some(s => /isDragging/i.test(s))).toBe(true)
  })

  test('suppresses external playhead updates while dragging', () => {
    expect(TimelineBarSource).toContain('if (!isDragging())')
    expect(TimelineBarSource).toContain('setPlayheadPct(elapsedToPlayheadPct(d.elapsed, props.frames))')
  })

  test('playhead position is bound as left percentage', () => {
    expect(TimelineBarSource).toContain('left:${playheadPct()}%')
  })

  // ── Hover tooltip ─────────────────────────────────────

  test('shows a hover tooltip with time label', () => {
    expect(result.signals.some(s => /hoverLabel/i.test(s))).toBe(true)
    expect(TimelineBarSource).toContain('hoverTimeLabel')
    expect(TimelineBarSource).toContain('koma-timeline-tooltip')
  })

  test('hover tooltip is positioned at the cursor x-offset', () => {
    expect(result.signals.some(s => /hoverLeftPx/i.test(s))).toBe(true)
    expect(TimelineBarSource).toContain('left:${hoverLeftPx()}px')
  })

  // ── Play/pause ────────────────────────────────────────

  test('renders a play/pause button that dispatches koma:toggleplay', () => {
    const playBtn = result.findAll({ tag: 'button' }).find(n =>
      n.classes.includes('koma-timeline-play'),
    )
    expect(playBtn).not.toBeUndefined()
    expect(playBtn!.events).toContain('click')
    expect(TimelineBarSource).toContain('koma:toggleplay')
  })

  test('play button label toggles between Play and Pause', () => {
    expect(result.signals.some(s => /isPlaying/i.test(s))).toBe(true)
    expect(TimelineBarSource).toContain("isPlaying() ? 'Pause' : 'Play'")
  })
})
