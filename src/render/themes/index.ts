// Theme registry. Each preset lives in its own file and is registered here.
// `THEMES` is keyed by `ThemeId`, so the type system requires every id to
// have a theme; the picker groups and the Shiki load list are derived from
// the registry, so adding a preset can't leave them out of sync.

import type { ThemeId } from '../../model/types'
import type { Theme, ThemeCategory, ShikiThemeReg } from './types'
import { piconic } from './piconic'
import { hono } from './hono'
import { barefoot } from './barefoot'

export type { Theme, ThemeCategory, ShikiThemeReg } from './types'

export const DEFAULT_THEME_ID: ThemeId = 'piconic'

// Record<ThemeId, Theme> — a missing or extra preset is a compile error.
export const THEMES: Record<ThemeId, Theme> = {
  piconic,
  hono,
  barefoot,
}

const ALL_THEMES = Object.values(THEMES)

export type ThemeGroup = { category: ThemeCategory; label: string; themes: Theme[] }

// Picker layout, derived from the registry so every theme lands in a group.
const CATEGORY_ORDER: ThemeCategory[] = ['partner', 'oss']
const CATEGORY_LABEL: Record<ThemeCategory, string> = {
  partner: 'Partner',
  oss: 'OSS',
}
export const THEME_GROUPS: ThemeGroup[] = CATEGORY_ORDER.map(category => ({
  category,
  label: CATEGORY_LABEL[category],
  themes: ALL_THEMES.filter(t => t.category === category),
}))

// Themes to register in the Shiki highlighter — bundled theme names plus any
// custom theme objects. Derived so a preset's syntax theme is always loaded.
const CUSTOM_SHIKI_THEMES: ShikiThemeReg[] = ALL_THEMES.map(t => t.customShikiTheme).filter(
  (t): t is ShikiThemeReg => Boolean(t),
)
const CUSTOM_NAMES = new Set(CUSTOM_SHIKI_THEMES.map(t => t.name))
const BUNDLED_THEME_NAMES = [
  ...new Set(ALL_THEMES.map(t => t.shikiTheme).filter(name => !CUSTOM_NAMES.has(name))),
]
export const SHIKI_THEMES_TO_LOAD: Array<string | ShikiThemeReg> = [
  ...BUNDLED_THEME_NAMES,
  ...CUSTOM_SHIKI_THEMES,
]

/** Resolve a (possibly undefined or unknown) id to a concrete theme. */
export function resolveTheme(id?: string): Theme {
  if (id && id in THEMES) return THEMES[id as ThemeId]
  return THEMES[DEFAULT_THEME_ID]
}
