import { defineConfig, presetWind4 } from 'unocss'

// Mirrors site/ui/uno.config.ts — keeps the registry components looking
// the way they do in the docs site. Theme colors point at the CSS
// variables defined in tokens.css so a `.dark` class on <html> flips
// the whole palette without re-running UnoCSS.
export default defineConfig({
  presets: [presetWind4()],
  preflights: [{
    getCSS: () => '*, ::before, ::after { border-color: var(--border); }',
    layer: 'base',
  }],
  outputToCssLayers: true,
  layers: {
    preflights: -2,
    components: -1,
    default: 0,
  },
  theme: {
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
      popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
      primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
      secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
      muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
      accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
      destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
      border: 'var(--border)',
      input: 'var(--input)',
      ring: 'var(--ring)',
    },
    radius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
    shadow: {
      sm: 'var(--shadow-sm)',
      DEFAULT: 'var(--shadow)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
    },
    font: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
  },
  content: {
    filesystem: ['components/**/*.tsx', 'public/components/**/*.tsx', 'server.tsx', 'renderer.tsx'],
  },
  // The unocss CLI doesn't read content.filesystem, so duplicate the
  // patterns here for `unocss` / `unocss --watch` invocations.
  cli: {
    entry: {
      patterns: ['components/**/*.tsx', 'public/components/**/*.tsx', 'server.tsx', 'renderer.tsx'],
      outFile: 'public/uno.css',
    },
  },
})
