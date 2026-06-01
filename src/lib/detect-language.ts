// Lightweight, dependency-free language detection for "Auto" frames.
//
// Shiki can't auto-detect, and pulling in highlight.js just to guess a
// language is heavier than this tool needs. Instead we score the code against
// a small set of high-signal markers per language. This is deliberately
// best-effort: it returns null when nothing scores, and the caller falls back
// to the document language. Accuracy matters less than never guessing wildly —
// a wrong language paints misleading colors, so each rule leans on markers
// that rarely appear outside their language.

import type { Language } from '../model/types'

type Rule = { lang: Language; score: (code: string) => number }

// Ordered roughly by marker specificity. `score` returns a rough confidence;
// the highest wins. Keep markers narrow so unrelated code scores 0.
const RULES: Rule[] = [
  { lang: 'php', score: c => (/<\?php\b/.test(c) ? 5 : 0) },
  {
    lang: 'html',
    score: c => {
      let s = 0
      if (/<!doctype html>/i.test(c)) s += 5
      if (/<(html|head|body|div|span|p|a|ul|li)\b[^>]*>/i.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'vue',
    score: c => (/<template>[\s\S]*<\/template>/.test(c) || /<script setup/.test(c) ? 5 : 0),
  },
  {
    lang: 'go',
    score: c => {
      let s = 0
      if (/^package\s+\w+/m.test(c)) s += 4
      if (/\bfunc\s+\w*\s*\(/.test(c)) s += 2
      if (/\bfmt\.\w+\(/.test(c)) s += 2
      if (/:=/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'rs',
    score: c => {
      let s = 0
      if (/\bfn\s+\w+\s*\(/.test(c)) s += 3
      if (/\blet\s+mut\b/.test(c)) s += 3
      if (/println!|format!|vec!/.test(c)) s += 3
      if (/->\s*[A-Za-z_][\w<>:]*\s*\{/.test(c)) s += 1
      if (/\b(impl|trait|pub\s+fn|use\s+std::)/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'py',
    score: c => {
      let s = 0
      if (/^\s*def\s+\w+\s*\(.*\)\s*:/m.test(c)) s += 4
      if (/^\s*class\s+\w+.*:\s*$/m.test(c)) s += 2
      if (/^\s*(import|from)\s+\w+/m.test(c) && !/;/.test(c)) s += 2
      if (/\b(elif|self|None|True|False)\b/.test(c)) s += 2
      if (/print\s*\(/.test(c)) s += 1
      if (/#!.*\bpython/.test(c)) s += 5
      return s
    },
  },
  {
    lang: 'rb',
    score: c => {
      let s = 0
      if (/\bdef\s+\w+[\s\S]*?\bend\b/.test(c)) s += 3
      if (/\bputs\s+/.test(c)) s += 2
      if (/\bdo\s*\|[^|]*\|/.test(c)) s += 2
      if (/\b(require|attr_accessor|elsif|nil)\b/.test(c)) s += 2
      if (/#!.*\bruby/.test(c)) s += 5
      if (/\bend\b/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'sh',
    score: c => {
      let s = 0
      if (/^#!.*\b(sh|bash|zsh)\b/.test(c)) s += 5
      if (/\b(echo|export|fi|esac)\b/.test(c)) s += 1
      if (/\$\{?\w+\}?/.test(c) && /\b(echo|then|do|done)\b/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'java',
    score: c => {
      let s = 0
      if (/\bpublic\s+(static\s+)?(class|void|int|String)\b/.test(c)) s += 3
      if (/System\.out\.print/.test(c)) s += 3
      if (/\bimport\s+java\./.test(c)) s += 3
      return s
    },
  },
  {
    lang: 'cs',
    score: c => {
      let s = 0
      if (/\busing\s+System\b/.test(c)) s += 4
      if (/Console\.Write/.test(c)) s += 3
      if (/\bnamespace\s+\w+/.test(c)) s += 2
      if (/\bpublic\s+\w+.*\{\s*get;\s*set;\s*\}/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'cpp',
    score: c => {
      let s = 0
      if (/#include\s*<\w+>/.test(c)) s += 2
      if (/std::\w+/.test(c)) s += 3
      if (/\b(cout|cin|template\s*<|namespace\s+\w+)\b/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'c',
    score: c => {
      let s = 0
      if (/#include\s*<\w+\.h>/.test(c)) s += 3
      if (/\bint\s+main\s*\(/.test(c)) s += 2
      if (/\bprintf\s*\(/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'kt',
    score: c => {
      let s = 0
      if (/\bfun\s+\w+\s*\(/.test(c)) s += 3
      if (/\bval\s+\w+|\bvar\s+\w+/.test(c)) s += 2
      if (/println\(/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'scala',
    score: c => {
      let s = 0
      if (/\bobject\s+\w+\s+extends\b/.test(c)) s += 3
      if (/\bdef\s+\w+.*:\s*\w+\s*=/.test(c)) s += 2
      if (/\bval\s+\w+\s*:/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'ex',
    score: c => {
      let s = 0
      if (/\bdefmodule\s+\w+/.test(c)) s += 4
      if (/\bdef\s+\w+.*\bdo\b/.test(c)) s += 2
      if (/\|>/.test(c)) s += 2
      if (/IO\.puts/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'hs',
    score: c => {
      let s = 0
      if (/^\s*module\s+\w+.*\bwhere\b/m.test(c)) s += 3
      if (/::.*->/.test(c)) s += 3
      if (/^\s*\w+\s*::\s*/m.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'fs',
    score: c => {
      let s = 0
      if (/\blet\s+\w+\s*=/.test(c) && /\|>/.test(c)) s += 3
      if (/printfn\b/.test(c)) s += 3
      if (/\bmember\b|\blet\s+rec\b/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'dart',
    score: c => {
      let s = 0
      if (/\bvoid\s+main\s*\(\s*\)/.test(c) && /print\(/.test(c)) s += 4
      if (/\bWidget\s+build\b/.test(c)) s += 3
      return s
    },
  },
  {
    lang: 'css',
    score: c => {
      let s = 0
      if (/[.#]?[\w-]+\s*\{[^}]*:[^}]*;[^}]*\}/.test(c)) s += 3
      if (/@(media|import|keyframes)\b/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'md',
    score: c => {
      let s = 0
      if (/^#{1,6}\s+\S/m.test(c)) s += 2
      if (/^\s*[-*]\s+\S/m.test(c)) s += 1
      if (/```/.test(c)) s += 2
      if (/\[[^\]]+\]\([^)]+\)/.test(c)) s += 2
      return s
    },
  },
  {
    lang: 'ts',
    score: c => {
      let s = 0
      // Type annotations are the clearest TS-over-JS signal.
      if (/:\s*(string|number|boolean|void|any|unknown|[A-Z]\w+)(\[\])?\b/.test(c)) s += 3
      if (/\b(interface|type)\s+\w+\s*[={]/.test(c)) s += 3
      if (/\benum\s+\w+/.test(c)) s += 2
      if (/\bas\s+(const|[A-Z]\w+)\b/.test(c)) s += 1
      if (/\b(function|const|let|=>)\b/.test(c)) s += 1
      return s
    },
  },
  {
    lang: 'js',
    score: c => {
      let s = 0
      if (/console\.log\(/.test(c)) s += 2
      if (/\b(function|const|let|var)\b/.test(c)) s += 1
      if (/=>/.test(c)) s += 1
      if (/\b(require|module\.exports|document\.)\b/.test(c)) s += 1
      return s
    },
  },
]

/**
 * Best-effort detect the language of a code snippet. Returns null when no rule
 * scores above zero, so the caller can fall back to a document default rather
 * than commit to a wrong guess.
 */
export function detectLanguage(code: string): Language | null {
  const src = code.trim()
  if (!src) return null

  let best: { lang: Language; score: number } | null = null
  for (const rule of RULES) {
    const score = rule.score(src)
    if (score > 0 && (!best || score > best.score)) {
      best = { lang: rule.lang, score }
    }
  }
  if (best && best.score >= 2) return best.lang

  // JSON is unambiguous when it parses, but its markers overlap with JS object
  // literals — only claim it as a last resort on a strict parse.
  if (/^[[{]/.test(src)) {
    try {
      JSON.parse(src)
      return 'json'
    } catch {
      /* not JSON */
    }
  }

  return best?.lang ?? null
}
