'use client'

import type { Frame, Language } from '../src/model/types'

interface FrameEditorProps {
  frame: Frame
  language: Language
  index: number
  total: number
  onCode: (code: string) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function FrameEditor(props: FrameEditorProps) {
  const onCodeInput = (e: Event) => {
    const t = e.currentTarget as HTMLTextAreaElement
    props.onCode(t.value)
  }

  const onCodeKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const t = e.currentTarget as HTMLTextAreaElement
    const { selectionStart: start, selectionEnd: end, value } = t
    const insertion = '  '
    const next = value.slice(0, start) + insertion + value.slice(end)
    t.value = next
    t.selectionStart = t.selectionEnd = start + insertion.length
    props.onCode(next)
  }

  return (
    <div className="koma-frame-editor">
      <div className="koma-frame-toolbar">
        <button
          type="button"
          className="koma-iconbtn"
          onClick={props.onDuplicate}
          aria-label="Duplicate frame"
        >
          ⧉
        </button>
        <button
          type="button"
          className="koma-iconbtn koma-iconbtn-danger"
          disabled={props.total <= 1}
          onClick={props.onRemove}
          aria-label="Delete frame"
        >
          ✕
        </button>
      </div>

      <textarea
        className="koma-code-input"
        spellcheck={false}
        data-language={props.language}
        value={props.frame.code}
        onInput={onCodeInput}
        onKeyDown={onCodeKey}
        rows={1}
        aria-label={`Frame ${props.index + 1} code`}
      />
    </div>
  )
}
