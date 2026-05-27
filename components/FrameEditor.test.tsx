import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const FrameEditorSource = readFileSync(resolve(__dirname, 'FrameEditor.tsx'), 'utf-8')

describe('FrameEditor', () => {
  const result = renderToTest(FrameEditorSource, 'FrameEditor.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is FrameEditor', () => {
    expect(result.componentName).toBe('FrameEditor')
  })

  test('no signals (stateless)', () => {
    expect(result.signals).toEqual([])
  })

  test('renders as <div>', () => {
    // Component has conditional return (e.g., asChild branch)
    expect(result.find({ tag: 'div' })).not.toBeNull()
  })

  test('has aria-label on interactive elements', () => {
    const all = result.findAll({})
    expect(all.some(n => n.props['aria-label'] != null)).toBe(true)
  })

  test('has event handlers', () => {
    const all = result.findAll({})
    expect(
      all.some(n => n.events.includes('click') || n.props['onClick'] != null),
    ).toBe(true)
    expect(
      all.some(n => n.events.includes('input') || n.props['onInput'] != null),
    ).toBe(true)
    expect(
      all.some(n => n.events.includes('keydown') || n.props['onKeyDown'] != null),
    ).toBe(true)
  })

  test('contains child components', () => {
    expect(result.find({ componentName: 'Button' })).not.toBeNull()
    expect(result.find({ componentName: 'XIcon' })).not.toBeNull()
    expect(result.find({ componentName: 'Textarea' })).not.toBeNull()
  })

  test('toStructure() shows expected tree', () => {
    const structure = result.toStructure()
    expect(structure.length).toBeGreaterThan(0)
    expect(structure).toContain('div')
  })
})
