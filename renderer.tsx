import { jsxRenderer } from 'hono/jsx-renderer'
import { BfScripts } from '@barefootjs/hono/scripts'

declare module 'hono' {
  interface ContextRenderer {
    (children: unknown, props?: { title?: string }): Response
  }
}

// No import map, and no `base`/`manifest` props on `<BfScripts />`: under
// the Vite build every island's compiled entry imports `@barefootjs/client`
// as an ordinary bundled specifier (Rollup folds it into one shared chunk,
// so there is a single runtime instance), and `HonoAdapter.generate()`
// bakes each component's Vite-resolved script URL in at codegen time.
export const renderer = jsxRenderer(({ children, title }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title ?? 'BarefootJS app'}</title>
      <meta name="description" content="Code, frame by frame." />
      {/* Link all three sheets so the browser fetches them in
          parallel — chaining via styles.css @import would defer
          tokens/uno to a second round-trip and flash unstyled DOM.
          tokens.css first so CSS variables are defined before any
          rule references them. */}
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      {/* JetBrains Mono — the code font for the canvas renderer. Loaded as a
          real web font so the preview and exported frames use it instead of
          falling back to the system monospace. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
      />
      <link rel="stylesheet" href="/tokens.css" />
      <link rel="stylesheet" href="/styles.css" />
      <link rel="stylesheet" href="/uno.css" />
    </head>
    <body>
      {children}
      <BfScripts />
    </body>
  </html>
))
