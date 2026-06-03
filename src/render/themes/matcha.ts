// 和柄 — 抹茶 (Matcha). A calm, earthy preset: stone-green outer over a warm
// washi-cream code card. Ships its own light Shiki theme in tea-garden greens
// so the code stays gentle and grounded rather than bright.

import type { Theme, ShikiThemeReg } from './types'

const MOSS = '#33402a'

// Tea-garden greens on warm washi — low saturation, restful to read.
const matchaTea: ShikiThemeReg = {
  name: 'koma-matcha',
  type: 'light',
  fg: MOSS,
  bg: '#f2efdf',
  settings: [
    { settings: { foreground: MOSS, background: '#f2efdf' } },
    { scope: ['comment'], settings: { foreground: '#9aa07e', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#6f8c3a' } },
    { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: '#3f6b1f' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#8a7a23' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#557029' } },
    { scope: ['variable.parameter', 'variable'], settings: { foreground: '#4a5238' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#8b9270' } },
  ],
}

export const matcha: Theme = {
  id: 'matcha',
  label: '抹茶',
  tagline: '抹茶 — 和の静けさ、落ち着いた抹茶色のプリセット。',
  category: 'wagara',
  homepage: 'https://ja.wikipedia.org/wiki/抹茶',
  shikiTheme: matchaTea.name,
  customShikiTheme: matchaTea,
  render: {
    outerBackground: '#7d9a4f',
    // Stone-green sweep, like whisked tea settling — lighter top, deeper base.
    outerGradient: {
      from: '#94ad62',
      to: '#5f7d36',
      angle: 150,
    },
    codeBackground: '#f2efdf',
    textColor: MOSS,
    cursorColor: '#4a7c1e',
    showLineNumbers: true,
    lineNumberColor: '#c3c19f',
    cardShadow: true,
  },
  sample: {
    language: 'ts',
    frames: [
      { code: `const teas = ['抹茶', '煎茶', '玉露']` },
      {
        code: `const teas = ['抹茶', '煎茶', '玉露']
const matcha = teas.find(t => t === '抹茶')`,
      },
      {
        code: `const teas = ['抹茶', '煎茶', '玉露']
const matcha = teas.find(t => t === '抹茶')

console.log(matcha) // 抹茶`,
      },
    ],
  },
}
