import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const ThemeBarSource = readFileSync(resolve(__dirname, 'ThemeBar.tsx'), 'utf-8')

describe('ThemeBar', () => {
  const result = renderToTest(ThemeBarSource, 'ThemeBar.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is ThemeBar', () => {
    expect(result.componentName).toBe('ThemeBar')
  })

  test('renders a single theme Select (language moved to per-frame)', () => {
    const selects = result.findAll({ componentName: 'Select' })
    expect(selects.length).toBe(1)
  })

  test('wires the theme Select to onThemeChange', () => {
    expect(ThemeBarSource).toContain('onThemeChange')
    expect(ThemeBarSource).toMatch(/onValueChange=\{[^}]*onThemeChange/)
  })

  test('groups the theme options by category', () => {
    // Each category renders a static label <div> followed by a themes.map() of
    // SelectItems, kept as direct children of SelectContent. (The earlier
    // hand-unrolled-per-item workaround for the multi-group .map() label-offset
    // miscompile is no longer needed since @barefootjs 0.6.0; wrapping the items
    // in a mapped SelectGroup instead leaves them un-hydrated, so they stay
    // flat.)
    expect(ThemeBarSource).toMatch(/THEME_GROUPS\[0\]\.themes\.map\(/)
    expect(ThemeBarSource).toMatch(/THEME_GROUPS\[1\]\.themes\.map\(/)
    expect(result.find({ componentName: 'SelectItem' })).not.toBeNull()
  })

  test('inlines a brand logo per theme in the selected trigger', () => {
    // The trigger can't reach a shared helper from its reactive effect scope,
    // so it inlines a logo per theme via independent && branches.
    expect(ThemeBarSource).toMatch(/props\.theme === 'hono' && <HonoLogo/)
    expect(ThemeBarSource).toMatch(/props\.theme === 'barefoot' && <BarefootLogo/)
    expect(ThemeBarSource).toMatch(/HonoLogo.*BarefootLogo.*PiconicLogo/s)
  })

  test('shows the tagline with the homepage link trailing it', () => {
    expect(ThemeBarSource).toContain('koma-theme-desc')
    expect(ThemeBarSource).toMatch(/resolveTheme\(props\.theme\)\.tagline/)
    expect(ThemeBarSource).toMatch(/resolveTheme\(props\.theme\)\.homepage/)
    const link = result.find({ tag: 'a' })
    expect(link).not.toBeNull()
    expect(ThemeBarSource.indexOf('.tagline')).toBeLessThan(ThemeBarSource.indexOf('koma-theme-link'))
  })

  // ── Theme Select behavior ─────────────────────────────

  test('defaults to DEFAULT_THEME_ID when props.theme is unset', () => {
    expect(ThemeBarSource).toContain("props.theme ?? DEFAULT_THEME_ID")
  })

  test('resolves theme label reactively from props.theme', () => {
    expect(ThemeBarSource).toContain('resolveTheme(props.theme).label')
  })

  test('homepage link opens in a new tab', () => {
    const link = result.find({ tag: 'a' })
    expect(link).not.toBeNull()
    expect(link!.props['target']).toBe('_blank')
    expect(link!.props['rel']).toContain('noreferrer')
  })

  test('casts the Select string value to ThemeId on change', () => {
    expect(ThemeBarSource).toContain('v as ThemeId')
  })

  test('accepts an optional style prop for width alignment', () => {
    expect(ThemeBarSource).toContain("props.style ?? ''")
  })
})
