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

  // ── Preview height resize ─────────────────────────────

  test('tracks the preview height in a signal', () => {
    expect(result.signals.some(s => /previewHeight/i.test(s))).toBe(true)
  })

  test('defaults to fit-to-column and flags the dock once resized', () => {
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
    expect(AppSource).toContain('--preview-height')
  })

  test('clamps the dragged height between a floor and the full-dock-width height', () => {
    expect(AppSource).toMatch(/Math\.max\(120,\s*Math\.min\(maxHeight/)
    expect(AppSource).toContain('fullWidthHeight')
  })

  // ── Editor width resize ───────────────────────────────

  test('derives editorWidth as a memo from spec().width with a 1080 default', () => {
    expect(result.memos).toContain('editorWidth')
    expect(AppSource).toContain('spec().width ?? 1080')
  })

  test('derives contentMaxWidth as a memo at 64% of editorWidth', () => {
    expect(result.memos).toContain('contentMaxWidth')
    expect(AppSource).toContain('editorWidth() * 0.64')
  })

  test('renders left and right editor resize handles with pointer-down handlers', () => {
    const handles = result.findAll({ tag: 'div' }).filter(n =>
      n.classes.includes('koma-editors-handle'),
    )
    expect(handles.length).toBe(2)
    const left = handles.find(n => n.classes.includes('koma-editors-handle--left'))
    const right = handles.find(n => n.classes.includes('koma-editors-handle--right'))
    expect(left).not.toBeUndefined()
    expect(right).not.toBeUndefined()
    expect(left!.events).toContain('pointerdown')
    expect(right!.events).toContain('pointerdown')
  })

  test('clamps editor width to 640–1920 range in 10px increments', () => {
    expect(AppSource).toMatch(/Math\.max\(640,\s*Math\.min\(1920/)
    expect(AppSource).toMatch(/Math\.round\(raw\s*\/\s*10\)\s*\*\s*10/)
  })

  test('edge drag uses 2:1 cursor-to-width ratio for both sides', () => {
    expect(AppSource).toContain('dx * 2')
    expect(AppSource).toMatch(/side === 'right' \? ev\.clientX - startX : startX - ev\.clientX/)
  })

  test('applies contentMaxWidth as max-width on the editors section', () => {
    const editors = result.find({ tag: 'section' })
    expect(editors).not.toBeNull()
    expect(editors!.aria['label']).toBe('Frame editors')
    expect(AppSource).toContain('max-width:${contentMaxWidth()}px')
  })

  test('applies contentMaxWidth to preview head and preview aside', () => {
    const styledDivs = result.findAll({ tag: 'div' }).filter(n =>
      n.classes.includes('koma-preview-head'),
    )
    expect(styledDivs.length).toBeGreaterThanOrEqual(1)
    const asides = result.findAll({ tag: 'aside' }).filter(n =>
      n.classes.includes('koma-preview'),
    )
    expect(asides.length).toBe(1)
  })

  test('passes spec (including width) to the Player', () => {
    expect(AppSource).toContain('spec={spec()}')
  })

  test('edge drag updates spec.width which propagates through editorWidth → contentMaxWidth', () => {
    expect(AppSource).toContain("setSpec(s => ({ ...s, width: clamped as CanvasWidth }))")
  })

  // ── Width persistence ─────────────────────────────────

  test('persists spec.width changes to the URL hash', () => {
    expect(AppSource).toContain('void spec().width')
    expect(AppSource).toContain('encodeToHash(spec())')
  })

  // ── Theme switching ───────────────────────────────────

  test('derives themeId and theme as memos from spec', () => {
    expect(result.memos).toContain('themeId')
    expect(result.memos).toContain('theme')
    expect(AppSource).toContain('spec().theme')
    expect(AppSource).toContain('resolveTheme(themeId())')
  })

  test('applyTheme swaps to sampleSpec on a pristine spec', () => {
    expect(AppSource).toContain('sampleSpec(id)')
    expect(AppSource).toMatch(/if\s*\(edited\(\)\)/)
  })

  test('applyTheme only changes theme (not code) on an edited spec', () => {
    expect(AppSource).toContain('setTheme(s, id)')
  })

  test('tracks edited state and marks it on user interaction', () => {
    expect(result.signals).toContain('edited')
    expect(AppSource).toContain('markEdited()')
  })

  test('passes theme shikiTheme and render colors to FrameEditor', () => {
    expect(AppSource).toContain('shikiTheme={theme().shikiTheme}')
    expect(AppSource).toContain('editorBg={theme().render.codeBackground}')
    expect(AppSource).toContain('editorFg={theme().render.textColor}')
    expect(AppSource).toContain('editorCaret={theme().render.cursorColor}')
  })

  test('passes themeId and applyTheme to ThemeBar', () => {
    expect(AppSource).toContain('theme={themeId()}')
    expect(AppSource).toContain('onThemeChange={applyTheme}')
  })

  test('persists theme changes to the URL hash', () => {
    expect(AppSource).toContain('void spec().theme')
  })

  // ── Language changes ──────────────────────────────────

  test('resolves frame language via frameLanguage helper', () => {
    expect(AppSource).toContain('frameLanguage(frame, spec())')
  })

  test('passes resolved language to each FrameEditor', () => {
    expect(AppSource).toContain('language={frameLanguage(frame, spec())}')
  })

  test('language changes update the spec via updateFrame', () => {
    expect(AppSource).toMatch(/onLanguage=\{.*updateFrame\(s, frame\.id, \{ language \}\)/)
  })

  test('code changes update the spec and mark it edited', () => {
    expect(AppSource).toMatch(/onCode=\{.*markEdited\(\).*updateFrame\(s, frame\.id, \{ code \}\)/)
  })

  // ── Frame management ──────────────────────────────────

  test('renders an add-frame button', () => {
    const addBtn = result.findAll({ tag: 'button' }).find(n =>
      n.aria['label'] === 'Add frame',
    )
    expect(addBtn).not.toBeUndefined()
    expect(addBtn!.events).toContain('click')
  })

  test('add-frame calls addFrame and marks edited', () => {
    expect(AppSource).toMatch(/markEdited\(\).*addFrame\(s\)/)
  })

  test('remove-frame calls removeFrame and marks edited', () => {
    expect(AppSource).toMatch(/markEdited\(\).*removeFrame\(s, frame\.id\)/)
  })

  test('maps spec.frames to FrameEditor components with index and total', () => {
    expect(AppSource).toContain('index={i}')
    expect(AppSource).toContain('total={spec().frames.length}')
    expect(AppSource).toContain('key={frame.id}')
  })

  test('tracks selectedFrameId for frame selection', () => {
    expect(result.signals).toContain('selectedFrameId')
    expect(AppSource).toContain('selected={selectedFrameId() === frame.id}')
    expect(AppSource).toContain('onSelect={setSelectedFrameId}')
  })

  // ── Preview expand/collapse ───────────────────────────

  test('tracks previewExpanded state', () => {
    expect(result.signals).toContain('previewExpanded')
  })

  test('auto-expands the preview on playback start', () => {
    expect(AppSource).toContain('koma:timeupdate')
    expect(AppSource).toContain('setPreviewExpanded(true)')
  })

  test('renders a toggle button to expand/collapse the preview', () => {
    const toggleBtn = result.findAll({ tag: 'button' }).find(n =>
      n.classes.includes('koma-preview-toggle'),
    )
    expect(toggleBtn).not.toBeUndefined()
    expect(toggleBtn!.events).toContain('click')
  })

  test('exposes data-collapsed on the dock when preview is collapsed', () => {
    expect(AppSource).toContain('data-collapsed')
  })
})
