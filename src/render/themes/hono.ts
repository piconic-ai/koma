// OSS — Hono ("flame"). Minimalist: an orange→red flame gradient outer with
// a GitHub-dark code style on a neutral dark card, plus the macOS
// traffic-light buttons. Texture comes from the subtle global grain only.

import type { Theme } from './types'

export const hono: Theme = {
  id: 'hono',
  label: 'Hono',
  tagline: 'Hono — means flame🔥 in Japanese — is a small, simple, and ultrafast web framework built on Web Standards.',
  category: 'oss',
  homepage: 'https://hono.dev',
  shikiTheme: 'github-dark',
  render: {
    outerBackground: '#f26227',
    // Rich, saturated Hono orange — vivid (pop) but not pale/yellow. A tight
    // range so no large washed-out area; slightly lighter top, deeper bottom.
    outerGradient: { from: '#fb7a36', to: '#e84e18' },
    codeBackground: '#1e1e1e',
    textColor: '#c9d1d9',
    cursorColor: '#58a6ff',
    showWindowChrome: true,
    // Same as the card so no title-bar strip shows — just the dots.
    chromeBackground: '#1e1e1e',
  },
  sample: {
    language: 'ts',
    frames: [
      { code: `import { Hono } from 'hono'` },
      {
        code: `import { Hono } from 'hono'

const app = new Hono()`,
      },
      {
        code: `import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))

export default app`,
      },
    ],
  },
}
