'use client'

import { createSignal, createEffect } from '@barefootjs/client'
import type { Frame, Language } from '../src/model/types'

interface FrameEditorProps {
  frame: Frame
  language: Language
  index: number
  total: number
  onCode: (code: string) => void
  onHold: (ms: number | undefined) => void
  onTransition: (ms: number | undefined) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function FrameEditor(props: FrameEditorProps) {
  const [showOptions, setShowOptions] = createSignal(false)

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

  const handlePopoverMount = (el: HTMLElement) => {
    const anchor = el.closest('.koma-popover-anchor') as HTMLElement | null
    if (!anchor) return

    const position = () => {
      const rect = anchor.getBoundingClientRect()
      el.style.position = 'fixed'
      el.style.top = `${rect.bottom + 4}px`
      el.style.left = `${rect.left}px`
    }

    createEffect(() => {
      if (showOptions()) {
        position()

        const onClickOutside = (e: MouseEvent) => {
          if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
            setShowOptions(false)
          }
        }
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') setShowOptions(false)
        }
        const onScroll = () => position()

        document.addEventListener('mousedown', onClickOutside)
        document.addEventListener('keydown', onKeyDown)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)

        return () => {
          document.removeEventListener('mousedown', onClickOutside)
          document.removeEventListener('keydown', onKeyDown)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
        }
      }
    })
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
        <div className="koma-popover-anchor">
          <button
            type="button"
            className="koma-iconbtn"
            onClick={() => setShowOptions(v => !v)}
            aria-label="Frame options"
          >
            ⚙
          </button>
          {showOptions() && (
            <div className="koma-popover" ref={handlePopoverMount}>
              <div className="koma-frame-options-grid">
                <label>
                  Hold (ms)
                  <input
                    type="number"
                    placeholder="auto"
                    value={props.frame.hold == null ? '' : String(props.frame.hold)}
                    onInput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value
                      props.onHold(v === '' ? undefined : Number(v))
                    }}
                  />
                </label>
                <label>
                  Transition (ms)
                  <input
                    type="number"
                    placeholder="auto"
                    value={
                      props.frame.transition?.duration == null
                        ? ''
                        : String(props.frame.transition.duration)
                    }
                    onInput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value
                      props.onTransition(v === '' ? undefined : Number(v))
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
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
