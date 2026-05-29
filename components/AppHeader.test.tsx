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

  test('shows a brand logo for each option and the selected trigger', () => {
    // Dropdown items go through the single themeLogo() source; the trigger
    // must inline its logos (bf can't reach themeLogo from the reactive
    // trigger scope), reactive via independent && branches per theme.
    expect(AppHeaderSource).toContain('{themeLogo(t.id)}')
    expect(AppHeaderSource).toMatch(/props\.theme === 'hono' && <HonoLogo/)
    expect(AppHeaderSource).toMatch(/props\.theme === 'barefoot' && <BarefootLogo/)
    expect(AppHeaderSource).toMatch(/HonoLogo.*BarefootLogo.*PiconicLogo/s)
  })
})
