// Visual presets for the rendered video.
//
// A theme only overrides the *surrounding* style — the outer background,
// the window chrome, and accent colors. The code window itself stays a
// dark surface and the syntax highlighting is always `github-dark` (see
// `highlighter.ts`), so code stays legible under every preset.
//
// The `Spec` persists only the `ThemeId` (see `src/model/types.ts`); the
// concrete render overrides live here.

import type { ThemeId } from '../model/types'
import type { RenderOptions } from './canvas'

export type ThemeCategory = 'partner' | 'oss'

export type Theme = {
  id: ThemeId
  /** Display label for the picker. */
  label: string
  category: ThemeCategory
  /** Official site, linked from the info button next to the picker. */
  homepage: string
  /** Partial render overrides merged over `DEFAULT_RENDER_OPTIONS`. */
  render: Partial<RenderOptions>
}

export const DEFAULT_THEME_ID: ThemeId = 'piconic'

export const THEMES: Record<ThemeId, Theme> = {
  // Partner — piconic.ai brand green. This is the default look, so its
  // overrides are empty (DEFAULT_RENDER_OPTIONS already carries #00b769).
  piconic: {
    id: 'piconic',
    label: 'piconic.ai',
    category: 'partner',
    homepage: 'https://piconic.ai',
    render: {},
  },

  // OSS — Hono ("flame"). The official logo is an orange→red flame
  // gradient (#F84 → #F30); we reproduce it as the outer background.
  hono: {
    id: 'hono',
    label: 'Hono',
    category: 'oss',
    homepage: 'https://hono.dev',
    render: { outerGradient: { from: '#ff8844', to: '#ff3300' } },
  },

  // OSS — Barefoot.js. The brand mark is monochrome, so we pair it with a
  // calm, warm-neutral "paper" backdrop that lets the dark code card read.
  barefoot: {
    id: 'barefoot',
    label: 'Barefoot.js',
    category: 'oss',
    homepage: 'https://barefootjs.dev',
    render: { outerBackground: '#ece7df' },
  },
}

export type ThemeGroup = { category: ThemeCategory; label: string; themes: Theme[] }

/** Picker layout: category groups in display order. */
export const THEME_GROUPS: ThemeGroup[] = [
  { category: 'partner', label: 'Partner', themes: [THEMES.piconic] },
  { category: 'oss', label: 'OSS', themes: [THEMES.hono, THEMES.barefoot] },
]

/** Resolve a (possibly undefined or unknown) id to a concrete theme. */
export function resolveTheme(id?: string): Theme {
  if (id && id in THEMES) return THEMES[id as ThemeId]
  return THEMES[DEFAULT_THEME_ID]
}
