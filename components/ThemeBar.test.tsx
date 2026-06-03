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
    expect(ThemeBarSource).toMatch(/THEME_GROUPS\[2\]\.themes\.map\(/)
    expect(result.find({ componentName: 'SelectItem' })).not.toBeNull()
  })

  test('inlines a brand logo per theme in the selected trigger', () => {
    // The trigger can't reach a shared helper from its reactive effect scope,
    // so it inlines a logo per theme via independent && branches.
    expect(ThemeBarSource).toMatch(/props\.theme === 'hono' && <HonoLogo/)
    expect(ThemeBarSource).toMatch(/props\.theme === 'barefoot' && <BarefootLogo/)
    expect(ThemeBarSource).toMatch(/HonoLogo.*BarefootLogo.*PiconicLogo/s)
    // The 和柄 presets each inline their own drawn motif too.
    expect(ThemeBarSource).toMatch(/props\.theme === 'sakura' && <SakuraLogo/)
    expect(ThemeBarSource).toMatch(/props\.theme === 'matcha' && <MatchaLogo/)
    expect(ThemeBarSource).toMatch(/props\.theme === 'sumi' && <SumiLogo/)
  })

  test('shows the tagline with the homepage link trailing it', () => {
    // The link went missing when the picker moved out of the header hover tip;
    // it lives here now, trailing the tagline inside the description.
    expect(ThemeBarSource).toContain('koma-theme-desc')
    expect(ThemeBarSource).toMatch(/resolveTheme\(props\.theme\)\.tagline/)
    expect(ThemeBarSource).toMatch(/resolveTheme\(props\.theme\)\.homepage/)
    const link = result.find({ tag: 'a' })
    expect(link).not.toBeNull()
    // The link is the last child of the description, i.e. it trails the tagline.
    expect(ThemeBarSource.indexOf('.tagline')).toBeLessThan(ThemeBarSource.indexOf('koma-theme-link'))
  })
})
