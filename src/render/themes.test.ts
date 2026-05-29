import { describe, expect, test } from 'bun:test'
import { THEMES, THEME_GROUPS, DEFAULT_THEME_ID, resolveTheme } from './themes'

describe('resolveTheme', () => {
  test('returns the default theme for undefined', () => {
    expect(resolveTheme(undefined).id).toBe(DEFAULT_THEME_ID)
  })

  test('returns the default theme for an unknown id', () => {
    expect(resolveTheme('nope').id).toBe(DEFAULT_THEME_ID)
  })

  test('returns the matching theme for a known id', () => {
    expect(resolveTheme('hono').id).toBe('hono')
    expect(resolveTheme('barefoot').id).toBe('barefoot')
  })
})

describe('THEMES registry', () => {
  test('every theme id matches its key', () => {
    for (const [key, theme] of Object.entries(THEMES)) {
      expect(theme.id).toBe(key as typeof theme.id)
    }
  })

  test('the default theme has no overrides (keeps DEFAULT_RENDER_OPTIONS)', () => {
    expect(THEMES[DEFAULT_THEME_ID].render).toEqual({})
  })

  test('there is no transparent theme', () => {
    expect((THEMES as Record<string, unknown>).transparent).toBeUndefined()
  })

  test('hono reproduces its flame as an outer gradient', () => {
    expect(THEMES.hono.render.outerGradient).toEqual({ from: '#ff8844', to: '#ff3300' })
  })

  test('every theme has a homepage URL', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.homepage).toMatch(/^https:\/\//)
    }
  })
})

describe('THEME_GROUPS', () => {
  test('Partner comes before OSS', () => {
    expect(THEME_GROUPS.map(g => g.category)).toEqual(['partner', 'oss'])
  })

  test('contains every theme exactly once', () => {
    const ids = THEME_GROUPS.flatMap(g => g.themes.map(t => t.id)).sort()
    expect(ids).toEqual(Object.keys(THEMES).sort())
  })

  test('Partner holds piconic, OSS holds hono and barefoot', () => {
    const byCategory = Object.fromEntries(
      THEME_GROUPS.map(g => [g.category, g.themes.map(t => t.id)]),
    )
    expect(byCategory.partner).toEqual(['piconic'])
    expect(byCategory.oss).toEqual(['hono', 'barefoot'])
  })
})
