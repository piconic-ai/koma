import { Hono } from 'hono'
import { renderer } from './renderer'
import { App } from '@/components/App'
import { DEFAULT_THEME_ID, sampleSpec } from './src/render/themes'

const app = new Hono()

app.use('*', renderer)

// SSR placeholder spec: the default theme's brand-fitting koma. On a fresh
// session the client picks a random theme + its sample before reveal.
const SAMPLE = sampleSpec(DEFAULT_THEME_ID)

app.get('/', (c) =>
  c.render(
    <App initialSpec={SAMPLE} />,
    { title: 'piconic koma' },
  ),
)

export default app
