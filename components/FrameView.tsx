'use client'

import { createEffect, createSignal, onMount } from '@barefootjs/client'
import type { Language } from '../src/model/types'
import { highlight, plainTokens, type TokenLine } from '../src/render/highlighter'

interface FrameViewProps {
  code: string
  language: Language
  showWindowChrome?: boolean
}

export function FrameView(props: FrameViewProps) {
  const initial: TokenLine[] = plainTokens(props.code)
  const [tokens, setTokens] = createSignal<TokenLine[]>(initial)

  // First paint shows plain text; once Shiki resolves we swap in tokens.
  onMount(() => {
    void highlight(props.code, props.language).then(setTokens).catch(() => {
      // Fall back to plain — surface nothing to the user.
    })
  })

  // Re-highlight whenever code or language changes.
  createEffect(() => {
    const code = props.code
    const language = props.language
    setTokens(plainTokens(code))
    void highlight(code, language).then(setTokens).catch(() => {})
  })

  return (
    <div className="koma-frame">
      {props.showWindowChrome !== false && (
        <div className="koma-titlebar">
          <span className="koma-dot koma-dot-red" />
          <span className="koma-dot koma-dot-yellow" />
          <span className="koma-dot koma-dot-green" />
        </div>
      )}
      <pre className="koma-code">
        {tokens().map((line, i) => (
          <div key={i} className="koma-line" data-line-index={i}>
            {line.length === 0 ? (
              <span key="empty">{' '}</span>
            ) : (
              line.map((token, j) => (
                <span key={j} style={token.color ? { color: token.color } : {}}>
                  {token.content}
                </span>
              ))
            )}
          </div>
        ))}
      </pre>
    </div>
  )
}
