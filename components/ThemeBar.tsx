'use client'

import {
  Select, SelectTrigger,
  SelectContent, SelectItem,
} from '@/components/ui/select'
import { HonoLogo, BarefootLogo, PiconicLogo, P2BHausLogo } from '@/components/brand-logos'
import type { ThemeId } from '../src/model/types'
import { THEMES, THEME_GROUPS, DEFAULT_THEME_ID, resolveTheme } from '../src/render/themes'

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
            {props.theme !== 'hono' && props.theme !== 'barefoot' && props.theme !== 'p2bhaus' && <PiconicLogo className="size-4" />}
            {props.theme === 'hono' && <HonoLogo className="size-4" />}
            {props.theme === 'barefoot' && <BarefootLogo className="size-4" />}
            {props.theme === 'p2bhaus' && <P2BHausLogo className="size-4" />}
            {resolveTheme(props.theme).label}
          </span>
        </SelectTrigger>
        <SelectContent align="start">
          {/* Hand-unrolled per item, NOT a per-category THEME_GROUPS.map.
              Two sibling .map()s under one parent miscompile in bf: the
              reactive-text effect for the 2nd group reads
              `parent.children[idx + <#headers>]`, ignoring the 1st group's
              items, so every OSS label is shifted by one (Hono rendered as
              "Barefoot.js"). Listing items statically binds each label to its
              own element. Keep in sync with THEME_GROUPS' categories. */}
          <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
            {THEME_GROUPS[0].label}
          </div>
          <SelectItem value={THEMES.piconic.id}>
            <span className="flex items-center gap-2">
              <PiconicLogo className="size-4" />
              {THEMES.piconic.label}
            </span>
          </SelectItem>
          <SelectItem value={THEMES.p2bhaus.id}>
            <span className="flex items-center gap-2">
              <P2BHausLogo className="size-4" />
              {THEMES.p2bhaus.label}
            </span>
          </SelectItem>
          <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
            {THEME_GROUPS[1].label}
          </div>
          <SelectItem value={THEMES.hono.id}>
            <span className="flex items-center gap-2">
              <HonoLogo className="size-4" />
              {THEMES.hono.label}
            </span>
          </SelectItem>
          <SelectItem value={THEMES.barefoot.id}>
            <span className="flex items-center gap-2">
              <BarefootLogo className="size-4" />
              {THEMES.barefoot.label}
            </span>
          </SelectItem>
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
