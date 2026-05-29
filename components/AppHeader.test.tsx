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
    // Each category is rendered as a static label followed by a
    // homogeneous `.map` of SelectItems — mixing label divs and items in
    // one map prevents SelectItem from wiring up its click handler once
    // compiled, so we keep the maps item-only.
    expect(AppHeaderSource).toContain('THEME_GROUPS[0].label')
    expect(AppHeaderSource).toContain('THEME_GROUPS[1].label')
    expect(result.find({ componentName: 'SelectItem' })).not.toBeNull()
  })

  test('shows a brand logo for each option and the selected trigger', () => {
    // Dropdown items use the themeLogo() helper (static per item). The
    // trigger uses a ternary on props.theme so the logo is reactive and
    // swaps on selection — a plain function call wouldn't re-evaluate.
    expect(AppHeaderSource).toContain('{themeLogo(t.id)}')
    expect(AppHeaderSource).toMatch(/props\.theme === 'hono'\s*\?\s*<HonoLogo/)
    expect(AppHeaderSource).toMatch(/HonoLogo.*BarefootLogo.*PiconicLogo/s)
  })
})
