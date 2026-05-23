import { describe, expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const FrameViewSource = readFileSync(
  resolve(__dirname, 'FrameView.tsx'),
  'utf-8',
)

describe('FrameView', () => {
  const result = renderToTest(FrameViewSource, 'FrameView.tsx')

  test('compiles without errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is FrameView', () => {
    expect(result.componentName).toBe('FrameView')
  })

  test('renders the window chrome wrapper', () => {
    const structure = result.toStructure()
    expect(structure).toContain('koma-frame')
  })
})
