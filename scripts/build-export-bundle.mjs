// Standalone export bundle.
//
// We pre-bundle the export module with esbuild and serve it from
// /components/koma-export.js. AppHeader dynamically imports it on the
// first Export click, keeping the heavy export pipeline out of the
// eagerly-loaded component bundles (see src/export/index.ts).
//
// It also avoided bf's inliner dup-identifier bug
// (piconic-ai/barefootjs#1542, fixed in bf 0.4.0), but the on-demand
// load is the reason to keep it.

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

await build({
  entryPoints: [path.join(root, 'src/export/index.ts')],
  outfile: path.join(root, 'public/components/koma-export.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  // `shiki` is loaded lazily via esm.sh at runtime (the dynamic
  // `import('https://esm.sh/shiki@4.1.0')` expression). Mark it
  // external so esbuild leaves the URL alone.
  external: ['shiki', 'https://*'],
  // Keep names readable in dev. Use --minify in a separate prod step.
  minify: false,
  sourcemap: false,
})

console.log('build-export-bundle: emitted public/components/koma-export.js')
