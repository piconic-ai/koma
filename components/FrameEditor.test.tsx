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
    expect(result.find({ tag: 'div' })).not.toBeNull()
  })

  // ── Accessibility ─────────────────────────────────────

  test('has aria-label on interactive elements', () => {
    const all = result.findAll({})
    expect(all.some(n => n.props['aria-label'] != null)).toBe(true)
  })

  // ── Event handlers ────────────────────────────────────

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

  // ── Child components ──────────────────────────────────

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

  // ── Language picker ───────────────────────────────────

  test('renders a per-frame language Select with Auto as default', () => {
    expect(result.find({ componentName: 'Select' })).not.toBeNull()
    expect(FrameEditorSource).toContain("props.frame.language ?? 'auto'")
  })

  test('includes an Auto option that resets language to undefined', () => {
    expect(FrameEditorSource).toContain("value=\"auto\"")
    expect(FrameEditorSource).toContain("v === 'auto' ? undefined")
  })

  test('maps LANGUAGE_OPTIONS to SelectItem entries', () => {
    expect(FrameEditorSource).toContain('LANGUAGE_OPTIONS.map(')
    expect(result.find({ componentName: 'SelectItem' })).not.toBeNull()
  })

  test('language picker has an accessible label with the frame index', () => {
    expect(FrameEditorSource).toMatch(/aria-label=\{`Frame \$\{props\.index \+ 1\} language`\}/)
  })

  test('language change calls onLanguage via handleLanguage', () => {
    expect(FrameEditorSource).toContain('onValueChange={handleLanguage}')
    expect(FrameEditorSource).toContain('props.onLanguage(')
  })

  // ── Fence parsing ─────────────────────────────────────

  test('parses a markdown fence on input and sets both language and code', () => {
    expect(FrameEditorSource).toContain('parseFence(value)')
    expect(FrameEditorSource).toContain('props.onLanguage(fence.language)')
    expect(FrameEditorSource).toContain('props.onCode(fence.rest)')
  })

  test('passes code through without fence when no fence is present', () => {
    expect(FrameEditorSource).toContain('props.onCode(value)')
  })

  // ── Syntax highlighting ───────────────────────────────

  test('re-highlights reactively when code or language changes', () => {
    expect(result.effects).toBeGreaterThan(0)
    expect(FrameEditorSource).toContain('props.frame.code')
    expect(FrameEditorSource).toContain('props.language')
    expect(FrameEditorSource).toContain('props.shikiTheme')
    expect(FrameEditorSource).toContain('highlight(code, language, shikiTheme)')
  })

  test('paints monochrome tokens synchronously before async Shiki resolves', () => {
    expect(FrameEditorSource).toContain('plainTokens(code)')
    expect(FrameEditorSource).toContain('paint(plainTokens(code))')
  })

  test('guards against stale async highlight with a sequence counter', () => {
    expect(FrameEditorSource).toContain('renderSeq')
    expect(FrameEditorSource).toContain('seq === renderSeq')
  })

  test('renders a highlight layer behind the textarea', () => {
    const highlight = result.findAll({ tag: 'pre' }).find(n =>
      n.classes.includes('koma-code-highlight'),
    )
    expect(highlight).not.toBeUndefined()
    expect(highlight!.aria['hidden']).toBe('true')
  })

  // ── Theme-driven editor colors ────────────────────────

  test('applies theme colors as CSS variables on the root div', () => {
    expect(FrameEditorSource).toContain('--koma-editor-bg:${props.editorBg}')
    expect(FrameEditorSource).toContain('--koma-editor-fg:${props.editorFg}')
    expect(FrameEditorSource).toContain('--koma-editor-caret:${props.editorCaret}')
  })

  test('sets data-language on the textarea for external styling', () => {
    expect(FrameEditorSource).toContain('data-language={props.language}')
  })

  // ── Frame removal ─────────────────────────────────────

  test('delete button is disabled when only one frame exists', () => {
    expect(FrameEditorSource).toContain('disabled={props.total <= 1}')
  })

  test('delete button fires onRemove', () => {
    expect(FrameEditorSource).toContain('onClick={props.onRemove}')
    expect(FrameEditorSource).toContain('aria-label="Delete frame"')
  })

  // ── Tab indent ────────────────────────────────────────

  test('Tab key inserts indentation via applyTabIndent', () => {
    expect(FrameEditorSource).toContain('applyTabIndent(el.value, el.selectionStart, el.selectionEnd)')
    expect(FrameEditorSource).toContain("e.key !== 'Tab'")
  })

  // ── Frame selection ───────────────────────────────────

  test('applies data-selected when the frame is selected', () => {
    expect(FrameEditorSource).toContain('data-selected={props.selected')
  })

  test('auto-scrolls and focuses on selection', () => {
    expect(FrameEditorSource).toContain("scrollIntoView({ behavior: 'smooth', block: 'center' })")
    expect(FrameEditorSource).toContain('textareaEl.focus()')
  })

  // ── Scroll sync ───────────────────────────────────────

  test('syncs highlight layer scroll with textarea scroll', () => {
    expect(FrameEditorSource).toContain('syncScroll')
    expect(FrameEditorSource).toContain("el.addEventListener('scroll', syncScroll)")
  })
})
