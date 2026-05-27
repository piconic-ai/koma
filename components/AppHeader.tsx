'use client'

import { createSignal } from '@barefootjs/client'
import {
  Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem,
} from '@/components/ui/select'
import type { CanvasWidth, Language, Spec } from '../src/model/types'

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

const WIDTH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1080', label: '1080px' },
  { value: '1280', label: '1280px' },
  { value: '1920', label: '1920px' },
]

interface AppHeaderProps {
  language: Language
  width: CanvasWidth
  spec: Spec
  onLanguageChange: (v: Language) => void
  onWidthChange: (v: CanvasWidth) => void
}

export function AppHeader(props: AppHeaderProps) {
  const [exportStatus, setExportStatus] = createSignal<string | null>(null)

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
        <Select value={String(props.width)} onValueChange={(v: string) => props.onWidthChange(Number(v) as CanvasWidth)}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder={`${props.width}px`} />
          </SelectTrigger>
          <SelectContent align="end">
            {WIDTH_OPTIONS.map(opt => (
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
