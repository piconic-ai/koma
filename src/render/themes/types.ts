// Shared types for the visual presets. The point of this module is that a
// theme can't be half-specified: the fields a preset MUST decide are
// required, so adding a new theme (or editing one) fails to compile until
// every core setting is filled in.

import type { ThemeId } from '../../model/types'
import type { RenderOptions } from '../canvas'

export type ThemeCategory = 'partner' | 'oss'

// A Shiki theme registration object, for presets that ship a custom theme
// instead of a bundled one. Kept loose; it's handed straight to Shiki.
export type ShikiThemeReg = {
  name: string
  type: 'light' | 'dark'
} & Record<string, unknown>

// Render values every theme MUST decide — no silent fallback to defaults,
// so a preset can't ship with a syntax theme but forgotten/mismatched
// window colors.
type RequiredRender = Required<
  Pick<RenderOptions, 'outerBackground' | 'codeBackground' | 'textColor' | 'cursorColor'>
>

// Everything else has a sensible default in DEFAULT_RENDER_OPTIONS and may
// be omitted by a theme.
type OptionalRender = Partial<
  Pick<
    RenderOptions,
    | 'outerGradient'
    | 'vignette'
    | 'showWindowChrome'
    | 'chromeBackground'
    | 'chromeDotColors'
    | 'showLineNumbers'
    | 'lineNumberColor'
    | 'grainAlpha'
    | 'cardShadow'
    | 'fontFamily'
  >
>

export type ThemeRender = RequiredRender & OptionalRender

export type Theme = {
  id: ThemeId
  /** Display label for the picker. */
  label: string
  category: ThemeCategory
  /** Official site (metadata; not currently surfaced in the UI). */
  homepage: string
  /** Shiki theme name used to tokenize the code. */
  shikiTheme: string
  /** A custom Shiki theme to register under `shikiTheme` (omit for bundled
   *  themes). Set `shikiTheme` to this object's `name` to keep them in sync. */
  customShikiTheme?: ShikiThemeReg
  /** Render overrides merged over `DEFAULT_RENDER_OPTIONS`. */
  render: ThemeRender
}
