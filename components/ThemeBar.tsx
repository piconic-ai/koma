'use client'

import {
  Select, SelectTrigger,
  SelectContent, SelectItem,
} from '@/components/ui/select'
import { HonoLogo, BarefootLogo, PiconicLogo, P2BHausLogo, SakuraLogo, MatchaLogo, SumiLogo } from '@/components/brand-logos'
import type { ThemeId } from '../src/model/types'
import { THEME_GROUPS, DEFAULT_THEME_ID, resolveTheme } from '../src/render/themes'

interface ThemeBarProps {
  theme?: ThemeId
  /** Inline style passthrough so the bar can match the preview column width. */
  style?: string
  onThemeChange: (v: ThemeId) => void
}

/**
 * Theme bar shown directly above the video preview. Pairing the picker with
 * the canvas gives the theme and its result a sense of unity, and leaves room
 * for the selected theme's tagline + homepage link beside it.
 */
export function ThemeBar(props: ThemeBarProps) {
  return (
    <div className="koma-theme-bar" style={props.style ?? ''}>
      <Select value={props.theme ?? DEFAULT_THEME_ID} onValueChange={(v: string) => props.onThemeChange(v as ThemeId)}>
        <SelectTrigger className="w-[170px]">
          <span className="flex items-center gap-2 truncate">
            {/* Inline reactive `&&` per theme. A module-level helper isn't
                reachable from the trigger's reactive effect scope (it throws
                "… is not defined" at hydration), and a bare function call in
                a JSX child wouldn't re-evaluate as props.theme changes. */}
            {props.theme !== 'hono' && props.theme !== 'barefoot' && props.theme !== 'p2bhaus' && props.theme !== 'sakura' && props.theme !== 'matcha' && props.theme !== 'sumi' && <PiconicLogo className="size-4" />}
            {props.theme === 'hono' && <HonoLogo className="size-4" />}
            {props.theme === 'barefoot' && <BarefootLogo className="size-4" />}
            {props.theme === 'p2bhaus' && <P2BHausLogo className="size-4" />}
            {props.theme === 'sakura' && <SakuraLogo className="size-4" />}
            {props.theme === 'matcha' && <MatchaLogo className="size-4" />}
            {props.theme === 'sumi' && <SumiLogo className="size-4" />}
            {resolveTheme(props.theme).label}
          </span>
        </SelectTrigger>
        <SelectContent align="start">
          {/* Two category groups: a static label <div> before each themes.map().
              SelectItems stay direct children of SelectContent so their click
              handlers hydrate (wrapping them in a mapped SelectGroup leaves the
              items inert). The earlier hand-unrolled workaround for the
              multi-group .map() label-offset miscompile is no longer needed
              since @barefootjs 0.6.0. Keep in sync with THEME_GROUPS. */}
          <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
            {THEME_GROUPS[0].label}
          </div>
          {THEME_GROUPS[0].themes.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                {t.id === 'piconic' && <PiconicLogo className="size-4" />}
                {t.id === 'p2bhaus' && <P2BHausLogo className="size-4" />}
                {t.id === 'hono' && <HonoLogo className="size-4" />}
                {t.id === 'barefoot' && <BarefootLogo className="size-4" />}
                {t.id === 'sakura' && <SakuraLogo className="size-4" />}
                {t.id === 'matcha' && <MatchaLogo className="size-4" />}
                {t.id === 'sumi' && <SumiLogo className="size-4" />}
                {t.label}
              </span>
            </SelectItem>
          ))}
          <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
            {THEME_GROUPS[1].label}
          </div>
          {THEME_GROUPS[1].themes.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                {t.id === 'piconic' && <PiconicLogo className="size-4" />}
                {t.id === 'p2bhaus' && <P2BHausLogo className="size-4" />}
                {t.id === 'hono' && <HonoLogo className="size-4" />}
                {t.id === 'barefoot' && <BarefootLogo className="size-4" />}
                {t.id === 'sakura' && <SakuraLogo className="size-4" />}
                {t.id === 'matcha' && <MatchaLogo className="size-4" />}
                {t.id === 'sumi' && <SumiLogo className="size-4" />}
                {t.label}
              </span>
            </SelectItem>
          ))}
          <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
            {THEME_GROUPS[2].label}
          </div>
          {THEME_GROUPS[2].themes.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                {t.id === 'piconic' && <PiconicLogo className="size-4" />}
                {t.id === 'p2bhaus' && <P2BHausLogo className="size-4" />}
                {t.id === 'hono' && <HonoLogo className="size-4" />}
                {t.id === 'barefoot' && <BarefootLogo className="size-4" />}
                {t.id === 'sakura' && <SakuraLogo className="size-4" />}
                {t.id === 'matcha' && <MatchaLogo className="size-4" />}
                {t.id === 'sumi' && <SumiLogo className="size-4" />}
                {t.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="koma-theme-desc">
        {resolveTheme(props.theme).tagline}{' '}
        <a
          className="koma-theme-link"
          href={resolveTheme(props.theme).homepage}
          target="_blank"
          rel="noreferrer"
        >
          {resolveTheme(props.theme).homepage}
        </a>
      </p>
    </div>
  )
}
