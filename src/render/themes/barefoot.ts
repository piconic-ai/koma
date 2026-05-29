// OSS — Barefoot.js. Brand-green outer with a faint vertical green gradient
// (echoing the subtle gradient on barefootjs.dev's hero text) and a vivid
// Dracula code style on its dark card.

import type { Theme } from './types'

export const barefoot: Theme = {
  id: 'barefoot',
  label: 'Barefoot.js',
  category: 'oss',
  homepage: 'https://barefootjs.dev',
  shikiTheme: 'dracula',
  render: {
    outerBackground: '#00b769',
    // Diagonal sweep (125°) echoing barefootjs.dev's hero text. The brand
    // green holds through most of the canvas; the deeper green only fills
    // the bottom-right corner, so the dark area stays small.
    outerGradient: {
      from: '#1fc77e',
      to: '#009257',
      angle: 125,
      stops: [
        { at: 0, color: '#1fc77e' },
        { at: 0.7, color: '#00b769' },
        { at: 1, color: '#009257' },
      ],
    },
    codeBackground: '#282a36',
    textColor: '#f8f8f2',
    cursorColor: '#50fa7b',
  },
}
