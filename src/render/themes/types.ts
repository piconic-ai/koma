// Shared types for the visual presets. The point of this module is that a
// theme can't be half-specified: the fields a preset MUST decide are
// required, so adding a new theme (or editing one) fails to compile until
// every core setting is filled in.

import type { Language, ThemeId } from '../../model/types'
import type { RenderOptions } from '../canvas'

export type ThemeCategory = 'partner' | 'oss' | 'wagara'

// The default koma (sample frames) shown for a theme when the user hasn't
// edited anything yet — code that fits the brand. Frame ids are assigned when
// the sample is applied to a Spec, so a preset only declares the code.
export type ThemeSample = {
  language: Language
  frames: Array<{ code: string }>
}

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
    | 'outerPattern'
    | 'outerGold'
    | 'vignette'
    | 'showWindowChrome'
    | 'chromeBackground'
    | 'chromeDotColors'
    | 'showLineNumbers'
    | 'lineNumberColor'
    | 'grainAlpha'
    | 'cardShadow'
    | 'cardBorderColor'
    | 'cardBorderWidth'
    | 'fontFamily'
  >
>

export type ThemeRender = RequiredRender & OptionalRender

export type Theme = {
  id: ThemeId
  /** Display label for the picker. */
  label: string
  /** One-line description shown in the picker's hover card. */
  tagline: string
  category: ThemeCategory
  /** Official site, linked from the picker's hover card. */
  homepage: string
  /** Shiki theme name used to tokenize the code. */
  shikiTheme: string
  /** A custom Shiki theme to register under `shikiTheme` (omit for bundled
   *  themes). Set `shikiTheme` to this object's `name` to keep them in sync. */
  customShikiTheme?: ShikiThemeReg
  /** Render overrides merged over `DEFAULT_RENDER_OPTIONS`. */
  render: ThemeRender
  /** Default koma shown when this theme is picked on a pristine (unedited)
   *  spec — code that suits the brand. */
  sample: ThemeSample
}
