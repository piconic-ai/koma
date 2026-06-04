// 和柄 — 墨 (Sumi). Sumi ink meets Kanazawa luxury: warm washi-toned charcoal
// strewn with gold leaf (砂子) over faint waves, a sumi-lacquer code card
// edged with a gold keyline, and a quiet ink Shiki theme warmed by a hint of
// antique gold — the feel of a high-end Kanazawa ryokan.

import type { Theme, ShikiThemeReg } from './types'

const WASHI = '#ece6d6'
const GOLD = '#c9a24e'

// Graded warm greys (sumi-e tonal range) on warm ink, with keywords lifted in
// a muted antique gold — ほんのり金色, not a loud accent.
const sumiInk: ShikiThemeReg = {
  name: 'koma-sumi',
  type: 'dark',
  fg: WASHI,
  bg: '#19160f',
  settings: [
    { settings: { foreground: WASHI, background: '#19160f' } },
    { scope: ['comment'], settings: { foreground: '#736a55', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#bcae8e' } },
    { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: GOLD, fontStyle: 'bold' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#d8b977' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#e4cf9d' } },
    { scope: ['variable.parameter', 'variable'], settings: { foreground: WASHI } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#8a7f64' } },
  ],
}

export const sumi: Theme = {
  id: 'sumi',
  label: '墨',
  tagline: '墨 — 金沢の宵、和紙にひと刷きの金。静かな墨と金のプリセット。',
  category: 'wagara',
  homepage: 'https://ja.wikipedia.org/wiki/墨',
  shikiTheme: sumiInk.name,
  customShikiTheme: sumiInk,
  render: {
    outerBackground: '#211d15',
    // Warm ink-wash sweep, like aged washi under low lantern light.
    outerGradient: {
      from: '#3a3326',
      to: '#13100a',
      angle: 135,
      stops: [
        { at: 0, color: '#3a3326' },
        { at: 0.6, color: '#221e15' },
        { at: 1, color: '#13100a' },
      ],
    },
    // Organic gold leaf (金雲) drifting from opposite corners, with 砂子
    // flecks trailing inward — irregular and hand-strewn, not a tiled grid.
    outerGold: {
      color: GOLD,
      corners: ['tl', 'br'],
      intensity: 1,
      scale: 0.62,
      seed: 7,
    },
    codeBackground: '#19160f',
    textColor: WASHI,
    cursorColor: GOLD,
    showLineNumbers: true,
    lineNumberColor: '#6e5d39',
    grainAlpha: 0.1,
    vignette: 0.26,
    cardShadow: true,
    // A thin gold keyline frames the sumi-lacquer card.
    cardBorderColor: 'rgba(201, 162, 78, 0.45)',
    cardBorderWidth: 1.5,
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
