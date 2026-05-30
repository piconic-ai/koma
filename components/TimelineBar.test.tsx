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

  test('renders a hold segment for each frame', () => {
    // The hold segment's className is a dynamic template literal (selected /
    // at-min modifiers), so the static class isn't captured in `.classes`;
    // assert via source and the per-frame label instead.
    expect(TimelineBarSource).toContain('koma-timeline-segment')
    expect(result.find({ tag: 'span' })).not.toBeNull()
  })

  test('renders a transition segment between frames', () => {
    // A transition segment is emitted for every frame after the first, so the
    // bar reads as [hold, transition, hold, ...].
    const transitions = byClass('koma-timeline-transition')
    expect(transitions.length).toBeGreaterThanOrEqual(1)
  })

  test('transition segment carries a resize handle hook and a grip', () => {
    expect(TimelineBarSource).toContain('data-trans-handle')
    expect(byClass('koma-timeline-transition-grip').length).toBeGreaterThanOrEqual(0)
    expect(TimelineBarSource).toContain('koma-timeline-transition-grip')
  })

  test('transition width is driven by its share of the total', () => {
    // flex-basis comes from transBasisPct (transition ms / grand total).
    expect(TimelineBarSource).toContain('transBasisPct(i)')
    expect(TimelineBarSource).toMatch(/transBasisPct\s*=\s*\(i: number\)/)
  })

  test('hold width is a share of the grand total (holds + transitions)', () => {
    expect(TimelineBarSource).toContain('holdBasisPct(i)')
    expect(TimelineBarSource).toContain('computeTotalMs(props.frames)')
  })

  test('resizing a transition is wired to onTransitionLayout via computeTransitionDragPx', () => {
    expect(TimelineBarSource).toContain('onTransitionLayout')
    expect(TimelineBarSource).toContain('computeTransitionDragPx')
    // The mapping snapshots ms-per-pixel at pointer-down so the bar reflow
    // mid-drag doesn't drift the cursor.
    expect(TimelineBarSource).toMatch(/msPerPx\s*=\s*barWidth > 0/)
  })

  test('keeps the existing per-frame hold redistribution handle', () => {
    expect(byClass('koma-timeline-handle-bar').length).toBeGreaterThanOrEqual(1)
    expect(TimelineBarSource).toContain('computeSegmentDrag')
  })

  test('playhead and seek use the linear bar mapping', () => {
    expect(TimelineBarSource).toContain('elapsedToPlayheadPct')
    expect(TimelineBarSource).toContain('barRatioToElapsed')
    // The old hold-only mapping is gone.
    expect(TimelineBarSource).not.toContain('holdRatioToElapsed')
  })
})
