'use client'

import { createEffect } from '@barefootjs/client'
import { Button } from '@/components/ui/button'
import {
  Select, SelectTrigger,
  SelectContent, SelectItem,
} from '@/components/ui/select'
import { XIcon } from '@/components/ui/icon'
import { Textarea } from '@/components/ui/textarea'
import { applyTabIndent } from '../src/lib/tab-indent'
import { parseFence } from '../src/lib/fence'
import { highlight, plainTokens, type TokenLine } from '../src/render/highlighter'
import type { Frame, Language } from '../src/model/types'

// Selectable languages (sorted by label). Mirrors the koma `Language` ids;
// "Auto" lives outside this list and maps to an unset per-frame language.
const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'c', label: 'C' },
  { value: 'cs', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'css', label: 'CSS' },
  { value: 'dart', label: 'Dart' },
  { value: 'ex', label: 'Elixir' },
  { value: 'fs', label: 'F#' },
  { value: 'go', label: 'Go' },
  { value: 'hs', label: 'Haskell' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'js', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'jsx', label: 'JSX' },
  { value: 'kt', label: 'Kotlin' },
  { value: 'md', label: 'Markdown' },
  { value: 'pl', label: 'Perl' },
  { value: 'php', label: 'PHP' },
  { value: 'text', label: 'Plain text' },
  { value: 'py', label: 'Python' },
  { value: 'rb', label: 'Ruby' },
  { value: 'rs', label: 'Rust' },
  { value: 'scala', label: 'Scala' },
  { value: 'sh', label: 'Shell' },
  { value: 'tsx', label: 'TSX' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'vue', label: 'Vue' },
]

export interface FrameEditorProps {
  frame: Frame
  /** Resolved language (per-frame override or Auto-detected), for styling. */
  language: Language
  /** Active preset's Shiki theme, so the editor highlights like the preview. */
  shikiTheme: string
  /** Preset code-window colors applied to the editing surface. */
  editorBg: string
  editorFg: string
  editorCaret: string
  index: number
  total: number
  selected: boolean
  onCode: (code: string) => void
  onLanguage: (language: Language | undefined) => void
  onRemove: () => void
}

export function FrameEditor(props: FrameEditorProps) {
  let textareaEl: HTMLTextAreaElement | null = null
  // The highlight layer painted behind the (transparent-text) textarea.
  let highlightEl: HTMLElement | null = null
  // Guards against an earlier async highlight resolving after a later one.
  let renderSeq = 0

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const tokensToHtml = (lines: TokenLine[]): string =>
    lines
      .map(line =>
        line
          .map(t => `<span style="color:${t.color ?? props.editorFg}">${escapeHtml(t.content)}</span>`)
          .join(''),
      )
      .join('\n')

  const paint = (lines: TokenLine[]) => {
    if (highlightEl) highlightEl.innerHTML = tokensToHtml(lines)
  }

  // Keep the highlight layer scrolled in lockstep with the textarea so long
  // lines stay aligned under the caret.
  const syncScroll = () => {
    if (highlightEl && textareaEl) {
      highlightEl.scrollTop = textareaEl.scrollTop
      highlightEl.scrollLeft = textareaEl.scrollLeft
    }
  }

  const handleHighlightRef = (el: HTMLElement) => {
    highlightEl = el
  }

  const handleInput = (e: Event) => {
    const value = (e.currentTarget as HTMLTextAreaElement).value
    // A leading markdown fence (```ts) sets the language and is stripped from
    // the code, so it never shows up in the rendered video.
    const fence = parseFence(value)
    if (fence) {
      props.onLanguage(fence.language)
      props.onCode(fence.rest)
      return
    }
    props.onCode(value)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const el = e.currentTarget as HTMLTextAreaElement
    const result = applyTabIndent(el.value, el.selectionStart, el.selectionEnd)
    el.value = result.value
    el.selectionStart = el.selectionEnd = result.cursor
    props.onCode(result.value)
  }

  const handleTextareaRef = (el: HTMLTextAreaElement) => {
    textareaEl = el
    el.addEventListener('scroll', syncScroll)
  }

  // "auto" resets to an unset (Auto-detected) per-frame language.
  const handleLanguage = (v: string) => {
    props.onLanguage(v === 'auto' ? undefined : (v as Language))
  }

  createEffect(() => {
    if (props.selected && textareaEl) {
      textareaEl.closest('.koma-frame-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      textareaEl.focus()
    }
  })

  // Re-highlight whenever the code or the (resolved) language changes. Paint
  // the monochrome tokens synchronously first so typing never lags, then
  // upgrade to Shiki's colors when the async pass resolves.
  createEffect(() => {
    const code = props.frame.code
    const language = props.language
    const shikiTheme = props.shikiTheme
    paint(plainTokens(code))
    syncScroll()
    const seq = ++renderSeq
    void highlight(code, language, shikiTheme)
      .then(lines => {
        if (seq === renderSeq) {
          paint(lines)
          syncScroll()
        }
      })
      .catch(() => {})
  })

  return (
    <div
      className="koma-frame-editor"
      data-selected={props.selected ? '' : undefined}
      style={`--koma-editor-bg:${props.editorBg};--koma-editor-fg:${props.editorFg};--koma-editor-caret:${props.editorCaret}`}
    >
      <div className="koma-frame-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="koma-iconbtn-danger"
          disabled={props.total <= 1}
          onClick={props.onRemove}
          aria-label="Delete frame"
        >
          <XIcon size="sm" />
        </Button>
      </div>

      <div className="koma-code-wrap">
        {/* Syntax-highlight layer painted behind the textarea. The textarea's
            own text is transparent, so this is what the user actually reads. */}
        <pre className="koma-code-highlight" aria-hidden="true" ref={handleHighlightRef} />
        <Textarea
          ref={handleTextareaRef}
          className="koma-code-input"
          spellcheck={false}
          data-language={props.language}
          value={props.frame.code}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label={`Frame ${props.index + 1} code`}
        />
      </div>

      {/* Per-frame language picker. Shows "auto" until set; pick a language
          here, or type a ```lang fence at the top of the frame. */}
      <div className="koma-frame-lang">
        <Select value={props.frame.language ?? 'auto'} onValueChange={handleLanguage}>
          <SelectTrigger
            className="koma-frame-lang-trigger"
            aria-label={`Frame ${props.index + 1} language`}
          >
            {props.frame.language ?? 'auto'}
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="auto">Auto</SelectItem>
            {LANGUAGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
