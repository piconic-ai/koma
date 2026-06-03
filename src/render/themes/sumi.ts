// 和柄 — 墨 (Sumi). An ink-wash preset: deep charcoal outer over a sumi-black
// code card. Ships its own dark Shiki theme in graded greys — like brush ink
// on paper, monochrome but with quiet tonal range rather than flat mono.

import type { Theme, ShikiThemeReg } from './types'

const WASHI = '#ece7db'

// Graded greys (sumi-e tonal range) on deep ink — quiet, no hue.
const sumiInk: ShikiThemeReg = {
  name: 'koma-sumi',
  type: 'dark',
  fg: WASHI,
  bg: '#1b1a17',
  settings: [
    { settings: { foreground: WASHI, background: '#1b1a17' } },
    { scope: ['comment'], settings: { foreground: '#6d6657', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#c7c1b2' } },
    { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: '#a8a293', fontStyle: 'bold' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#d8d2c3' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#f2ede1' } },
    { scope: ['variable.parameter', 'variable'], settings: { foreground: WASHI } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#8a8475' } },
  ],
}

export const sumi: Theme = {
  id: 'sumi',
  label: '墨',
  tagline: '墨 — 墨絵のような、静かなモノクロのプリセット。',
  category: 'wagara',
  homepage: 'https://ja.wikipedia.org/wiki/墨',
  shikiTheme: sumiInk.name,
  customShikiTheme: sumiInk,
  render: {
    outerBackground: '#2a2825',
    // Ink-wash sweep: a lighter sumi grey draining into deep ink.
    outerGradient: {
      from: '#3b3833',
      to: '#161512',
      angle: 135,
    },
    codeBackground: '#1b1a17',
    textColor: WASHI,
    cursorColor: WASHI,
    showLineNumbers: true,
    lineNumberColor: '#55514a',
  },
  sample: {
    language: 'ts',
    frames: [
      { code: `const strokes: string[] = []` },
      {
        code: `const strokes: string[] = []
strokes.push('一', '二', '三')`,
      },
      {
        code: `const strokes: string[] = []
strokes.push('一', '二', '三')

console.log(strokes.join('')) // 一二三`,
      },
    ],
  },
}
