// Partner — piconic. Brand-green outer with a bright, minimal light code
// window. Ships its own monochrome Shiki theme so the code is a single
// near-black ink (no syntax colors), with a line-number gutter.

import type { Theme, ShikiThemeReg } from './types'

const INK = '#1a1a1a'

// All tokens render as `fg` (no scope overrides) → monochrome code.
const monoLight: ShikiThemeReg = {
  name: 'koma-mono-light',
  type: 'light',
  fg: INK,
  bg: '#ffffff',
  settings: [{ settings: { foreground: INK, background: '#ffffff' } }],
}

export const piconic: Theme = {
  id: 'piconic',
  label: 'piconic',
  tagline: 'Baby steps to Giant strides.',
  category: 'partner',
  homepage: 'https://piconic.ai',
  shikiTheme: monoLight.name,
  customShikiTheme: monoLight,
  render: {
    outerBackground: '#00b769',
    codeBackground: '#ffffff',
    textColor: INK,
    cursorColor: INK,
    showLineNumbers: true,
    lineNumberColor: '#c4c4c4',
  },
}
