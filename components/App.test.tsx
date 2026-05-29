import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const AppSource = readFileSync(resolve(__dirname, 'App.tsx'), 'utf-8')

describe('App', () => {
  const result = renderToTest(AppSource, 'App.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is App', () => {
    expect(result.componentName).toBe('App')
  })

  test('tracks the preview height in a signal', () => {
    expect(result.signals.some(s => /previewHeight/i.test(s))).toBe(true)
  })

  test('defaults to fit-to-column and flags the dock once resized', () => {
    // Default display fits the editor column width; dragging the handle flips
    // previewResized, which toggles data-resized to switch sizing modes.
    expect(result.signals.some(s => /previewResized/i.test(s))).toBe(true)
    expect(AppSource).toContain('data-resized')
    expect(AppSource).toContain('setPreviewResized(true)')
  })

  test('renders a preview resize handle wired to a pointer-down handler', () => {
    const handle = result.find({ role: 'separator' })
    expect(handle).not.toBeNull()
    expect(handle!.classes).toContain('koma-preview-resize')
    expect(handle!.events).toContain('pointerdown')
    expect(handle!.aria['label']).toBe('Resize preview height')
  })

  test('exposes the preview height to the canvas via a CSS variable', () => {
    // The dock publishes --preview-height; the canvas caps maxHeight on it so
    // the aspect ratio is preserved while the height shrinks.
    expect(AppSource).toContain('--preview-height')
  })

  test('clamps the dragged height between a floor and the full-dock-width height', () => {
    // Lower floor of 120px; upper bound lets the preview grow until it spans
    // the full dock width, so it can be enlarged past the editor column.
    expect(AppSource).toMatch(/Math\.max\(120,\s*Math\.min\(maxHeight/)
    expect(AppSource).toContain('fullWidthHeight')
  })
})
