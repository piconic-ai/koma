import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const AppHeaderSource = readFileSync(resolve(__dirname, 'AppHeader.tsx'), 'utf-8')

describe('AppHeader', () => {
  const result = renderToTest(AppHeaderSource, 'AppHeader.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is AppHeader', () => {
    expect(result.componentName).toBe('AppHeader')
  })

  test('renders a theme Select alongside the language Select', () => {
    const selects = result.findAll({ componentName: 'Select' })
    // One for theme, one for language.
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })

  test('wires the theme Select to onThemeChange', () => {
    const source = AppHeaderSource
    // The theme Select forwards onValueChange to the onThemeChange prop.
    expect(source).toContain('onThemeChange')
    expect(source).toMatch(/onValueChange=\{[^}]*onThemeChange/)
  })

  test('groups the theme options by category', () => {
    // Hand-unrolled per category: a dynamic THEME_GROUPS.map with a wrapping
    // element + nested item map miscompiles in bf (duplicate __compEl), so
    // the groups stay flat and explicit.
    expect(AppHeaderSource).toContain('THEME_GROUPS[0].label')
    expect(AppHeaderSource).toContain('THEME_GROUPS[1].label')
    expect(result.find({ componentName: 'SelectItem' })).not.toBeNull()
  })

  test('reveals a hover tip with the theme tagline and a homepage link', () => {
    // The tip is a single portaled overlay in AppHeader's own scope, driven by
    // a document-level mouseover delegate. (A HoverCard nested inside the
    // portaled SelectContent fails to hydrate on bf 0.5.1 — see
    // piconic-ai/barefootjs#1688 — so the tip lives outside the dropdown.)
    expect(AppHeaderSource).toContain('data-koma-theme-tip')
    expect(AppHeaderSource).toContain('THEME_ID_SET')
    expect(AppHeaderSource).toContain('{tipTheme()?.tagline}')
    expect(AppHeaderSource).toMatch(/href=\{tipTheme\(\)\?\.homepage\}/)
    expect(AppHeaderSource).toMatch(/target="_blank"/)
  })

  test('inlines a brand logo per theme in the selected trigger', () => {
    // The trigger can't reach a shared helper from its reactive effect scope,
    // so it inlines a logo per theme via independent && branches.
    expect(AppHeaderSource).toMatch(/props\.theme === 'hono' && <HonoLogo/)
    expect(AppHeaderSource).toMatch(/props\.theme === 'barefoot' && <BarefootLogo/)
    expect(AppHeaderSource).toMatch(/HonoLogo.*BarefootLogo.*PiconicLogo/s)
  })
})
