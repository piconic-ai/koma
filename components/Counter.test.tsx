import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const CounterSource = readFileSync(resolve(__dirname, 'Counter.tsx'), 'utf-8')

describe('Counter', () => {
  const result = renderToTest(CounterSource, 'Counter.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is Counter', () => {
    expect(result.componentName).toBe('Counter')
  })

  test('has expected signals', () => {
    expect(result.signals).toContain('count')
  })

  test('renders as <div>', () => {
    expect(result.root.tag).toBe('div')
  })

  test('has event handlers', () => {
    const all = result.findAll({})
    expect(
      all.some(n => n.events.includes('click') || n.props['onClick'] != null),
    ).toBe(true)
  })

  test('contains child components', () => {
    expect(result.find({ componentName: 'Button' })).not.toBeNull()
  })

  test('toStructure() shows expected tree', () => {
    const structure = result.toStructure()
    expect(structure.length).toBeGreaterThan(0)
    expect(structure).toContain('div')
  })
})
