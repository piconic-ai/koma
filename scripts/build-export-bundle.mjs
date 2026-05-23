// Standalone export bundle.
//
// The bf inliner does not deduplicate transitive imports across
// subtrees and currently emits multiple top-level
// `const __bf_inline_N = ...` declarations with the same N when one
// `'use client'` component reaches into a deep transitive tree.
// Tracking: piconic-ai/barefootjs#1542
//
// To keep the export pipeline working without depending on that fix
// landing, we pre-bundle the export module with esbuild and serve it
// from /components/. The App `await import`s the bundle at runtime,
// which sidesteps bf's inliner entirely for this subtree.

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
