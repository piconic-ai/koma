import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { barefoot } from '@barefootjs/hono/vite'

const HERE = dirname(fileURLToPath(import.meta.url))

// Two output trees, deliberately separate:
//
//   public/components/  — Vite's client build (hashed `.js` chunks and the
//                         shared BarefootJS runtime). Served by Workers
//                         Assets, which points at `public/` as a whole, so
//                         `base: '/components/'` is the URL these resolve
//                         to and what `HonoAdapter.generate()` bakes into
//                         every SSR template's `<script src>`.
//   dist/components/    — the compiled SSR `.tsx` templates wrangler's own
//                         bundler imports via tsconfig's `@/components/*`
//                         mapping. Never served over HTTP.
export default defineConfig({
  base: '/components/',
  resolve: {
    // Mirrors tsconfig.json's `@/components/*` mapping for Vite's own
    // resolver, which has no notion of tsconfig `paths`. Points at the
    // SOURCE tree: the client bundler only ever needs the real `.tsx` to
    // bundle, never the compiled SSR output.
    alias: {
      '@/components': resolve(HERE, 'components'),
    },
  },
  // `build.outDir` is a subdirectory of `public/`, so Vite's default
  // `publicDir` behavior would copy `public/`'s other contents
  // (tokens.css, styles.css, uno.css, favicon.svg) into it on every
  // build — files Workers Assets already serves straight from `public/`.
  publicDir: false,
  build: {
    outDir: 'public/components',
    emptyOutDir: true,
  },
  plugins: barefoot({
    components: ['components'],
    templates: 'dist/components',
  }),
})
