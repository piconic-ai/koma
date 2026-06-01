// Markdown code-fence parsing for the per-frame language input.
//
// Instead of a language dropdown, a frame's language is set by typing a
// markdown fence at the very top — e.g. ```ts — which this module recognizes,
// resolves to a `Language`, and strips so the fence never reaches the rendered
// video. This is the seed of "pour a whole markdown doc in" later: the same
// info-string vocabulary drives both.

import type { Language } from '../model/types'

// Info-string aliases → canonical koma `Language`. Covers the fenced-block
// names people actually type, mapped onto our id set.
const ALIASES: Record<string, Language> = {
  c: 'c', h: 'c',
  cs: 'cs', csharp: 'cs', 'c#': 'cs',
  cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  css: 'css',
  dart: 'dart',
  ex: 'ex', exs: 'ex', elixir: 'ex',
  fs: 'fs', fsharp: 'fs', 'f#': 'fs',
  go: 'go', golang: 'go',
  hs: 'hs', haskell: 'hs',
  html: 'html', htm: 'html',
  java: 'java',
  js: 'js', javascript: 'js', mjs: 'js', cjs: 'js', node: 'js',
  json: 'json',
  jsx: 'jsx',
  kt: 'kt', kotlin: 'kt', kts: 'kt',
  md: 'md', markdown: 'md',
  pl: 'pl', perl: 'pl',
  php: 'php',
  text: 'text', txt: 'text', plaintext: 'text', plain: 'text', none: 'text',
  py: 'py', python: 'py',
  rb: 'rb', ruby: 'rb',
  rs: 'rs', rust: 'rs',
  scala: 'scala',
  sh: 'sh', shell: 'sh', bash: 'sh', shellscript: 'sh', zsh: 'sh',
  tsx: 'tsx',
  ts: 'ts', typescript: 'ts',
  vue: 'vue',
}

export type FenceResult = {
  /** Resolved language, or undefined for an explicit "auto" reset. */
  language: Language | undefined
  /** The code with the fence line removed. */
  rest: string
}

/**
 * Parse a leading markdown code fence. Returns the resolved language (undefined
 * when the info string is empty or "auto" — a deliberate reset to Auto) and the
 * code with the fence line stripped, or null when the first line isn't a fence
 * with a recognized info string.
 *
 * Only fires once a newline exists after the fence, so we don't strip the line
 * out from under the user while they're still typing ```typescript.
 */
export function parseFence(code: string): FenceResult | null {
  const nl = code.indexOf('\n')
  if (nl < 0) return null
  const first = code.slice(0, nl)
  const m = /^\s*(?:`{3,}|~{3,})\s*([A-Za-z0-9#+._-]*)\s*$/.exec(first)
  if (!m) return null

  const info = m[1].toLowerCase()
  const rest = code.slice(nl + 1)
  if (info === '' || info === 'auto') return { language: undefined, rest }

  const lang = ALIASES[info]
  if (!lang) return null
  return { language: lang, rest }
}
