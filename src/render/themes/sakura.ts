// 和柄 — 桜 (Sakura). A soft spring preset: pale petal-pink outer fading into
// blossom pink, over a near-white code card. Ships its own light Shiki theme
// in muted plum/rose tones so the code reads like ink on washi, not a loud
// rainbow.

import type { Theme, ShikiThemeReg } from './types'

const PLUM = '#5a3a48'

// Soft rose/plum palette — gentle saturation so nothing screams against the
// pale pink card.
const sakuraBlossom: ShikiThemeReg = {
  name: 'koma-sakura',
  type: 'light',
  fg: PLUM,
  bg: '#fff5f8',
  settings: [
    { settings: { foreground: PLUM, background: '#fff5f8' } },
    { scope: ['comment'], settings: { foreground: '#bf9aaa', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#bb4a78' } },
    { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: '#d6336c' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#a05bb0' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#c25685' } },
    { scope: ['variable.parameter', 'variable'], settings: { foreground: '#7a4f5e' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#c79aaa' } },
  ],
}

export const sakura: Theme = {
  id: 'sakura',
  label: '桜',
  tagline: '桜 — 春のひとひら、淡い桜色のプリセット。',
  category: 'wagara',
  homepage: 'https://ja.wikipedia.org/wiki/サクラ',
  shikiTheme: sakuraBlossom.name,
  customShikiTheme: sakuraBlossom,
  render: {
    outerBackground: '#eaa6c0',
    // Soft spring sweep: pale petal pink up top, deepening to blossom pink,
    // holding the mid-tone so the top stays delicate and a corner deepens.
    outerGradient: {
      from: '#f7d8e3',
      to: '#df8eb0',
      angle: 155,
      stops: [
        { at: 0, color: '#f7d8e3' },
        { at: 0.55, color: '#efb6cd' },
        { at: 1, color: '#df8eb0' },
      ],
    },
    // 桜小紋 — pale petals scattered over the pink, like falling blossoms.
    outerPattern: { kind: 'sakura', color: '#ffffff', opacity: 0.18, scale: 158 },
    codeBackground: '#fff6f9',
    textColor: PLUM,
    cursorColor: '#e0578a',
    showLineNumbers: true,
    lineNumberColor: '#e7bccb',
    grainAlpha: 0.05,
    vignette: 0.12,
    cardShadow: true,
  },
  sample: {
    language: 'ts',
    frames: [
      { code: `const sakura = '🌸'` },
      {
        code: `const sakura = '🌸'
const bloom = (n: number) => sakura.repeat(n)`,
      },
      {
        code: `const sakura = '🌸'
const bloom = (n: number) => sakura.repeat(n)

console.log(bloom(3)) // 🌸🌸🌸`,
      },
    ],
  },
}
