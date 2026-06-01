// Partner — P2B Haus. A craft beer bar in Japan where engineers gather.
// The brand's golden-yellow becomes the outer; the code sits in a clean white
// card with full (light) syntax highlighting — bright and easy to read.

import type { Theme } from './types'

export const p2bhaus: Theme = {
  id: 'p2bhaus',
  label: 'P2B Haus',
  tagline: 'A craft beer bar where Japanese engineers gather.',
  category: 'partner',
  homepage: 'https://p2b.haus',
  shikiTheme: 'github-light',
  render: {
    // Flat, vivid P2B Haus golden yellow (no vignette — it muddies the color).
    outerBackground: '#f5c518',
    codeBackground: '#ffffff',
    textColor: '#1f2328',
    cursorColor: '#1f2328',
  },
  sample: {
    language: 'php',
    frames: [
      { code: `<?php

function beer() {` },
      {
        code: `<?php

function beer(string $name): string
{
    return "Cheers, {$name}!";
}`,
      },
      {
        code: `<?php

function beer(string $name): string
{
    return "Cheers, {$name}!";
}

echo beer('P2B Haus');`,
      },
    ],
  },
}
