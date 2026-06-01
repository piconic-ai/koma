'use client'

import { createSignal } from '@barefootjs/client'
import {
  Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem,
} from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { InfoIcon, GitHubIcon } from '@/components/ui/icon'
import { HonoLogo, BarefootLogo, PiconicLogo } from '@/components/brand-logos'
import type { Language, Spec, ThemeId } from '../src/model/types'
import { THEME_GROUPS, DEFAULT_THEME_ID, resolveTheme } from '../src/render/themes'

type ExportProgress = { current: number; total: number }
type ExportOptions = { reduceMotion?: boolean }
type ExportModule = {
  exportAll: (
    spec: Spec,
    onProgress?: (p: ExportProgress) => void,
    options?: ExportOptions,
  ) => Promise<Blob>
  downloadBlob: (blob: Blob, filename: string) => void
}

let exportModulePromise: Promise<ExportModule> | null = null
const loadExport = (): Promise<ExportModule> => {
  if (!exportModulePromise) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- URL resolved by the browser, served as a static asset
    exportModulePromise = import(/* @vite-ignore */ '/components/koma-export.js')
  }
  return exportModulePromise
}

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'ts', label: 'TypeScript' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'js', label: 'JavaScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'py', label: 'Python' },
  { value: 'rs', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'rb', label: 'Ruby' },
  { value: 'pl', label: 'Perl' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sh', label: 'Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Plain text' },
]

interface AppHeaderProps {
  language: Language
  spec: Spec
  theme?: ThemeId
  onLanguageChange: (v: Language) => void
  onThemeChange: (v: ThemeId) => void
}

export function AppHeader(props: AppHeaderProps) {
  const [exportStatus, setExportStatus] = createSignal<string | null>(null)
  const [infoOpen, setInfoOpen] = createSignal(false)

  const reducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onExport = async () => {
    setExportStatus('Exporting…')
    try {
      const mod = await loadExport()
      const blob = await mod.exportAll(
        props.spec,
        (p: ExportProgress) =>
          setExportStatus(`Exporting ${p.current} / ${p.total}`),
        { reduceMotion: reducedMotion() },
      )
      mod.downloadBlob(blob, 'koma.zip')
      setExportStatus('Done')
      setTimeout(() => setExportStatus(null), 2000)
    } catch (err) {
      console.error(err)
      setExportStatus('Export failed')
    }
  }

  return (
    <header className="koma-app-header">
      <h1 className="koma-app-title">
        <svg className="koma-app-logo" viewBox="55 48 390 104" xmlns="http://www.w3.org/2000/svg" aria-label="piconic"><g fill="#00b769"><path d="M136.32,53.25c-3.1,0-5.62,2.49-5.62,5.56,0,3.07,2.52,5.56,5.62,5.56,3.1,0,5.62-2.49,5.62-5.56s-2.52-5.56-5.62-5.56Z"/><rect x="132.05" y="75.12" width="8.53" height="49.65"/><path d="M371.34,52.88c-3.1,0-5.62,2.49-5.62,5.56s2.52,5.56,5.62,5.56c3.1,0,5.62-2.49,5.62-5.56s-2.52-5.56-5.62-5.56Z"/><rect x="367.08" y="75.12" width="8.53" height="49.65"/><path d="M248.89,74.52c-14.02,0-25.14,11.41-25.14,25.42s11.12,25.42,25.14,25.42,25.14-11.4,25.14-25.42-11.12-25.42-25.14-25.42ZM248.89,116.28c-9.01,0-16.62-7.33-16.62-16.33s7.61-16.33,16.62-16.33,16.62,7.33,16.62,16.33-7.61,16.33-16.62,16.33Z"/><path d="M199.11,111.56c-3.02,2.92-7.14,4.72-11.61,4.72-9.01,0-16.62-7.33-16.62-16.33s7.61-16.33,16.62-16.33c4.47,0,8.59,1.81,11.61,4.72l6.28-6.28c-4.54-4.65-10.85-7.53-17.89-7.53-14.02,0-25.14,11.41-25.14,25.42s11.12,25.42,25.14,25.42c7.05,0,13.36-2.88,17.89-7.53l-6.28-6.28Z"/><path d="M434.13,111.56c-3.02,2.92-7.14,4.72-11.61,4.72-9.01,0-16.62-7.33-16.62-16.33s7.61-16.33,16.62-16.33c4.47,0,8.59,1.81,11.61,4.72l6.28-6.28c-4.54-4.65-10.85-7.53-17.89-7.53-14.02,0-25.14,11.41-25.14,25.42s11.12,25.42,25.14,25.42c7.05,0,13.36-2.88,17.89-7.53l-6.28-6.28Z"/><path d="M319.49,74.52c-14.02,0-25.14,11.41-25.14,25.42h0v24.83h8.53v-24.83c0-9.01,7.61-16.33,16.62-16.33s16.62,7.33,16.62,16.33v24.83h8.53v-24.83h0c0-14.02-11.12-25.42-25.14-25.42Z"/><path d="M85,74.52c-14.02,0-25.14,11.41-25.14,25.42v46.78h8.53v-27.7c4.41,3.93,10.2,6.34,16.62,6.34,14.02,0,25.14-11.4,25.14-25.42s-11.12-25.42-25.14-25.42ZM85,116.28c-9.01,0-16.62-7.33-16.62-16.33s7.61-16.33,16.62-16.33,16.62,7.33,16.62,16.33-7.61,16.33-16.62,16.33Z"/></g></svg>
        <span className="koma-app-wordmark">koma</span>
      </h1>
      <div className="koma-app-header-right">
        <Popover open={infoOpen()} onOpenChange={setInfoOpen}>
          <PopoverTrigger className="koma-info-btn" aria-label="About piconic koma">
            <InfoIcon size="sm" />
          </PopoverTrigger>
          <PopoverContent align="end" className="koma-info-popover">
            <p className="koma-info-lead">
              <strong>piconic koma</strong> stitches your frame-by-frame code into a single video.
            </p>
            <p className="koma-info-note">“koma” is Japanese for “frame.”</p>
            <p className="koma-info-note">
              Built with{' '}
              <a href="https://hono.dev" target="_blank" rel="noreferrer">Hono</a>
              {' '}and{' '}
              <a href="https://barefootjs.dev/" target="_blank" rel="noreferrer">Barefoot.js</a>.
            </p>
            <div className="koma-info-links">
              <a
                className="koma-info-link"
                href="https://github.com/piconic-ai/koma"
                target="_blank"
                rel="noreferrer"
              >
                <GitHubIcon size="sm" />
                <span>View the source on GitHub</span>
              </a>
              <p className="koma-info-contact">Questions or feedback? Reach out to kobaken:</p>
              <ul className="koma-info-contact-list">
                <li>
                  <a href="https://x.com/kfly8" target="_blank" rel="noreferrer">x.com/kfly8</a>
                </li>
                <li>
                  <a href="mailto:kentafly88@gmail.com">kentafly88@gmail.com</a>
                </li>
              </ul>
            </div>
          </PopoverContent>
        </Popover>
        <Select value={props.theme ?? DEFAULT_THEME_ID} onValueChange={(v: string) => props.onThemeChange(v as ThemeId)}>
          <SelectTrigger className="w-[170px]">
            <span className="flex items-center gap-2 truncate">
              {/* Inline reactive `&&` per theme. A module-level helper isn't
                  reachable from the trigger's reactive effect scope (it throws
                  "… is not defined" at hydration), and a bare function call in
                  a JSX child wouldn't re-evaluate as props.theme changes. */}
              {props.theme !== 'hono' && props.theme !== 'barefoot' && <PiconicLogo className="size-4" />}
              {props.theme === 'hono' && <HonoLogo className="size-4" />}
              {props.theme === 'barefoot' && <BarefootLogo className="size-4" />}
              {resolveTheme(props.theme).label}
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            {/* Hand-unrolled per category. A dynamic THEME_GROUPS.map with a
                wrapping element + nested item .map makes the bf compiler emit
                a duplicate `__compEl` declaration, so the groups stay flat and
                explicit. Keep this in sync with THEME_GROUPS' categories. */}
            <div role="presentation" className="px-2 py-1.5 text-sm font-semibold text-foreground">
              {THEME_GROUPS[0].label}
            </div>
            {THEME_GROUPS[0].themes.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  {t.id !== 'hono' && t.id !== 'barefoot' && <PiconicLogo className="size-4" />}
                  {t.id === 'hono' && <HonoLogo className="size-4" />}
                  {t.id === 'barefoot' && <BarefootLogo className="size-4" />}
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
                  {t.id !== 'hono' && t.id !== 'barefoot' && <PiconicLogo className="size-4" />}
                  {t.id === 'hono' && <HonoLogo className="size-4" />}
                  {t.id === 'barefoot' && <BarefootLogo className="size-4" />}
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={props.language} onValueChange={(v: string) => props.onLanguageChange(v as Language)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={LANGUAGE_OPTIONS.find(o => o.value === props.language)?.label ?? 'Language...'} />
          </SelectTrigger>
          <SelectContent align="end">
            {LANGUAGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {exportStatus() !== null ? (
          <span className="koma-export-status" aria-live="polite">
            {exportStatus()}
          </span>
        ) : (
          <button
            type="button"
            className="koma-export-btn"
            onClick={onExport}
          >
            Export
          </button>
        )}
      </div>
    </header>
  )
}
