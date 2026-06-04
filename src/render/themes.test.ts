import { describe, expect, test } from 'bun:test'
import { THEMES, THEME_GROUPS, DEFAULT_THEME_ID, resolveTheme, randomThemeId, SHIKI_THEMES_TO_LOAD } from './themes'

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

describe('randomThemeId', () => {
  test('always returns a registered theme id', () => {
    const ids = new Set(Object.keys(THEMES))
    for (let i = 0; i < 100; i++) {
      expect(ids.has(randomThemeId())).toBe(true)
    }
  })

  test('can return every theme over enough draws', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(randomThemeId())
    expect([...seen].sort()).toEqual(Object.keys(THEMES).sort())
  })
})

describe('THEMES registry', () => {
  test('every theme id matches its key', () => {
    for (const [key, theme] of Object.entries(THEMES)) {
      expect(theme.id).toBe(key as typeof theme.id)
    }
  })

  test('there is no transparent theme', () => {
    expect((THEMES as Record<string, unknown>).transparent).toBeUndefined()
  })

  test('hono uses a vivid orange gradient (no vignette darkening)', () => {
    expect(THEMES.hono.render.outerGradient).toEqual({ from: '#fb7a36', to: '#e84e18' })
    expect(THEMES.hono.render.vignette).toBeUndefined()
  })

  test('every theme carries a shiki code theme and its own code background', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.shikiTheme.length).toBeGreaterThan(0)
      expect(theme.render.codeBackground).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  test('presets use distinct code styles', () => {
    const shiki = Object.values(THEMES).map(t => t.shikiTheme)
    expect(new Set(shiki).size).toBe(shiki.length)
    expect(THEMES.piconic.shikiTheme).toBe('koma-mono-light')
    expect(THEMES.hono.shikiTheme).toBe('github-dark')
    expect(THEMES.barefoot.shikiTheme).toBe('dracula')
  })

  test('the 和柄 presets each ship their own custom shiki theme', () => {
    for (const id of ['sakura', 'matcha', 'sumi'] as const) {
      const theme = THEMES[id]
      expect(theme.category).toBe('wagara')
      expect(theme.customShikiTheme).toBeDefined()
      expect(theme.shikiTheme).toBe(theme.customShikiTheme!.name)
    }
    expect(THEMES.sakura.shikiTheme).toBe('koma-sakura')
    expect(THEMES.matcha.shikiTheme).toBe('koma-matcha')
    expect(THEMES.sumi.shikiTheme).toBe('koma-sumi')
  })

  test('桜 and 抹茶 carry a traditional motif and texture (not flat)', () => {
    const motifs = { sakura: 'sakura', matcha: 'shippo' } as const
    for (const [id, kind] of Object.entries(motifs)) {
      const r = THEMES[id as keyof typeof motifs].render
      const layers = Array.isArray(r.outerPattern) ? r.outerPattern : [r.outerPattern!]
      expect(layers.some(l => l.kind === kind)).toBe(true)
      for (const l of layers) expect(l.color).toMatch(/^#[0-9a-f]{3,8}$/i)
      // depth: a multi-stop gradient, film grain and a vignette, not a flat fill.
      expect(r.outerGradient?.stops?.length).toBeGreaterThan(2)
      expect(r.grainAlpha ?? 0).toBeGreaterThan(0)
      expect(r.vignette ?? 0).toBeGreaterThan(0)
    }
  })

  test('墨 is ink-first: gold is a single brush line, never a pooled area', () => {
    const r = THEMES.sumi.render
    // No tiled motif and no corner gold pool.
    expect(r.outerPattern).toBeUndefined()
    expect(r.outerGold).toBeUndefined()
    // Gold is carried as one dry-brush stroke (a line, not a filled corner).
    expect(r.goldBrush?.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(r.goldBrush!.from).toHaveLength(2)
    expect(r.goldBrush!.to).toHaveLength(2)
    expect(r.goldBrush!.opacity ?? 1).toBeLessThanOrEqual(0.6)
    // Hand-made washi paper texture over ground + card.
    expect(r.washi?.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(r.washi!.cardAlpha ?? 0).toBeGreaterThan(0)
    // Depth from grain + a deep vignette.
    expect(r.grainAlpha ?? 0).toBeGreaterThan(0)
    expect(r.vignette ?? 0).toBeGreaterThan(0)
    // Code stays graded ink: the keyword tone is desaturated, not a gold accent.
    const kw = THEMES.sumi.customShikiTheme!.settings as Array<{ scope?: string[]; settings: { foreground?: string } }>
    const keyword = kw.find(s => s.scope?.includes('keyword'))?.settings.foreground ?? ''
    const n = parseInt(keyword.replace('#', ''), 16)
    const [rr, gg, bb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    expect(Math.max(rr, gg, bb) - Math.min(rr, gg, bb)).toBeLessThan(70)
  })

  test('every theme has a homepage URL', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.homepage).toMatch(/^https:\/\//)
    }
  })

  test('every theme declares the required render colors (no omissions)', () => {
    for (const theme of Object.values(THEMES)) {
      for (const key of ['outerBackground', 'codeBackground', 'textColor', 'cursorColor'] as const) {
        expect(theme.render[key]).toMatch(/^#[0-9a-f]{3,8}$/i)
      }
    }
  })

  test('a custom shiki theme name matches the preset shikiTheme', () => {
    for (const theme of Object.values(THEMES)) {
      if (theme.customShikiTheme) {
        expect(theme.shikiTheme).toBe(theme.customShikiTheme.name)
      }
    }
  })
})

describe('SHIKI_THEMES_TO_LOAD (derived from the registry)', () => {
  test('includes every preset’s syntax theme', () => {
    const names = new Set(
      SHIKI_THEMES_TO_LOAD.map(t => (typeof t === 'string' ? t : t.name)),
    )
    for (const theme of Object.values(THEMES)) {
      expect(names.has(theme.shikiTheme)).toBe(true)
    }
  })

  test('custom themes are passed as objects, bundled ones as names', () => {
    expect(SHIKI_THEMES_TO_LOAD).toContain('github-dark')
    expect(SHIKI_THEMES_TO_LOAD).toContain('dracula')
    const custom = SHIKI_THEMES_TO_LOAD.find(
      t => typeof t !== 'string' && t.name === 'koma-mono-light',
    )
    expect(custom).toBeDefined()
  })
})

describe('THEME_GROUPS', () => {
  test('Partner, then OSS, then 和柄', () => {
    expect(THEME_GROUPS.map(g => g.category)).toEqual(['partner', 'oss', 'wagara'])
  })

  test('contains every theme exactly once', () => {
    const ids = THEME_GROUPS.flatMap(g => g.themes.map(t => t.id)).sort()
    expect(ids).toEqual(Object.keys(THEMES).sort())
  })

  test('Partner holds piconic and p2bhaus, OSS holds hono and barefoot, 和柄 holds sakura/matcha/sumi', () => {
    const byCategory = Object.fromEntries(
      THEME_GROUPS.map(g => [g.category, g.themes.map(t => t.id)]),
    )
    expect(byCategory.partner).toEqual(['piconic', 'p2bhaus'])
    expect(byCategory.oss).toEqual(['hono', 'barefoot'])
    expect(byCategory.wagara).toEqual(['sakura', 'matcha', 'sumi'])
  })

  test('the 和柄 group is labelled 和柄', () => {
    const wagara = THEME_GROUPS.find(g => g.category === 'wagara')
    expect(wagara?.label).toBe('和柄')
  })
})
