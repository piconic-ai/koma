// 和柄 — 墨 (Sumi). Ink is the whole point: a deep sumi-black ground where the
// only warmth is the faintest breath of gold (金沢の金箔) drifting in a far
// corner. The code is graded sumi greys; gold never competes with the ink.

import type { Theme, ShikiThemeReg } from './types'

const WASHI = '#e7e2d6'
// A clean, luminous leaf-gold — vivid even when used in the faintest amount.
const GOLD = '#edc55a'

// Graded sumi greys (墨絵 tonal range) on near-black ink. Keywords carry only a
// breath of warmth — not gold — so nothing pulls focus from the ink.
const sumiInk: ShikiThemeReg = {
  name: 'koma-sumi',
  type: 'dark',
  fg: WASHI,
  bg: '#161410',
  settings: [
    { settings: { foreground: WASHI, background: '#161410' } },
    { scope: ['comment'], settings: { foreground: '#6a6353', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#a9a288' } },
    { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: '#a99e80', fontStyle: 'bold' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#bdb393' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#d7d0bd' } },
    { scope: ['variable.parameter', 'variable'], settings: { foreground: WASHI } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#7c7460' } },
  ],
}

export const sumi: Theme = {
  id: 'sumi',
  label: '墨',
  tagline: '墨 — 深い墨色に、ひと刷きの金の気配。静かな墨のプリセット。',
  category: 'wagara',
  homepage: 'https://ja.wikipedia.org/wiki/墨',
  shikiTheme: sumiInk.name,
  customShikiTheme: sumiInk,
  render: {
    outerBackground: '#1a1813',
    // Near-black sumi wash with only a hint of warmth — ink, not brown.
    outerGradient: {
      from: '#262219',
      to: '#100e0a',
      angle: 135,
      stops: [
        { at: 0, color: '#262219' },
        { at: 0.55, color: '#181610' },
        { at: 1, color: '#100e0a' },
      ],
    },
    // 金箔 — the faintest gold drift in one far corner only, but a true,
    // vivid leaf-gold (with the odd glint) so the little there is reads as
    // real gold, not a dull wash. Never competes with the ink.
    outerGold: {
      color: GOLD,
      corners: ['br'],
      intensity: 0.32,
      scale: 0.5,
      seed: 7,
    },
    // Hand-made washi: fibres + specks over the ground and the card surface.
    washi: {
      color: '#d8cdb4',
      alpha: 0.55,
      cardAlpha: 0.24,
      scale: 320,
    },
    codeBackground: '#161410',
    textColor: WASHI,
    cursorColor: GOLD,
    showLineNumbers: true,
    lineNumberColor: '#564f3f',
    grainAlpha: 0.06,
    vignette: 0.28,
    cardShadow: true,
    // Barely-there warm keyline — felt, not seen.
    cardBorderColor: 'rgba(237, 197, 90, 0.18)',
    cardBorderWidth: 1,
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
