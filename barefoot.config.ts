import { createConfig } from '@barefootjs/hono/build'

export default createConfig({
  // Project layout — read by `bf add`, `search`, `meta:extract`, etc.
  paths: {
    components: 'components/ui',
    tokens: 'tokens',
    meta: 'meta',
  },
  // Build inputs and output. barefoot mirrors the input dir under
  // `outDir`, so `components/` lands at `public/components/` —
  // exactly where Workers Assets serves it from.
  components: ['components'],
  outDir: 'public',
  scriptBasePath: '/components/',
  adapterOptions: {
    clientJsBasePath: '/components/',
    barefootJsPath: '/components/barefoot.js',
  },
})
