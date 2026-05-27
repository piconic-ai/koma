'use client'

import { createEffect } from '@barefootjs/client'
import { Button } from '@/components/ui/button'
import { XIcon } from '@/components/ui/icon'
import { Textarea } from '@/components/ui/textarea'
import { applyTabIndent } from '../src/lib/tab-indent'
import type { Frame, Language } from '../src/model/types'

export interface FrameEditorProps {
  frame: Frame
  language: Language
  index: number
  total: number
  selected: boolean
  onCode: (code: string) => void
  onRemove: () => void
}

export function FrameEditor(props: FrameEditorProps) {
  let textareaEl: HTMLTextAreaElement | null = null

  const handleInput = (e: Event) => {
    props.onCode((e.currentTarget as HTMLTextAreaElement).value)
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
  }

  createEffect(() => {
    if (props.selected && textareaEl) {
      textareaEl.closest('.koma-frame-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      textareaEl.focus()
    }
  })

  return (
    <div className="koma-frame-editor" data-selected={props.selected ? '' : undefined}>
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
  )
}
