// Lazy Shiki highlighter shared across the app.
//
// Shiki's WASM + grammars are heavy, so the engine is loaded lazily
// on first use. The full module is `await import`'d so server bundles
// stay free of the dependency.

import type { Highlighter } from 'shiki'
import type { Language } from '../model/types'

// Shiki's identifiers for each Language. Some koma languages map to
// shiki under a different name (e.g. 'sh' → 'shellscript').
const SHIKI_LANG: Record<Language, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  pl: 'perl',
  html: 'html',
  css: 'css',
  sh: 'shellscript',
  json: 'json',
  text: 'text',
}

export const KOMA_THEME = 'github-dark'

let highlighterPromise: Promise<Highlighter> | null = null

async function loadHighlighter(): Promise<Highlighter> {
  // Use esm.sh so the browser can resolve Shiki + its WASM dependencies
  // without us needing a client-side bundler. The version is pinned so
  // we don't get surprised by a major bump. The same module loads as a
  // regular import in Node for tests.
  const shikiUrl = 'https://esm.sh/shiki@4.1.0'
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- URL import resolved at runtime by the browser
  const mod = await import(/* @vite-ignore */ shikiUrl)
  const { createHighlighter } = mod as { createHighlighter: typeof import('shiki').createHighlighter }
  return createHighlighter({
    themes: [KOMA_THEME],
    langs: [
      'typescript',
      'tsx',
      'javascript',
      'jsx',
      'python',
      'rust',
      'go',
      'ruby',
      'perl',
      'html',
      'css',
      'shellscript',
      'json',
    ],
  })
}

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = loadHighlighter()
  }
  return highlighterPromise
}

export type Token = { content: string; color?: string }
export type TokenLine = Token[]

export async function highlight(
  code: string,
  language: Language,
): Promise<TokenLine[]> {
  if (language === 'text') {
    return plainTokens(code)
  }
  const hl = await getHighlighter()
  const tokens = hl.codeToTokensBase(code, {
    lang: SHIKI_LANG[language] as any,
    theme: KOMA_THEME,
  })
  return tokens.map(line =>
    line.map(t => ({ content: t.content, color: t.color })),
  )
}

export function plainTokens(code: string): TokenLine[] {
  return code.split('\n').map(line => [{ content: line }])
}
