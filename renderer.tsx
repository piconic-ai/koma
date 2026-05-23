import { jsxRenderer } from 'hono/jsx-renderer'
import { BfImportMap } from '@barefootjs/hono/app'
import { BfScripts } from '@barefootjs/hono/scripts'
import manifest from './public/components/manifest.json'

declare module 'hono' {
  interface ContextRenderer {
    (children: unknown, props?: { title?: string }): Response
  }
}

const componentsBase = '/components'

export const renderer = jsxRenderer(({ children, title }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title ?? 'BarefootJS app'}</title>
      {/* Link all three sheets so the browser fetches them in
          parallel — chaining via styles.css @import would defer
          tokens/uno to a second round-trip and flash unstyled DOM.
          tokens.css first so CSS variables are defined before any
          rule references them. */}
      <link rel="stylesheet" href="/tokens.css" />
      <link rel="stylesheet" href="/styles.css" />
      <link rel="stylesheet" href="/uno.css" />
      <BfImportMap base={componentsBase} />
    </head>
    <body>
      {children}
      <BfScripts base={componentsBase} manifest={manifest} />
    </body>
  </html>
))
