import { Hono } from 'hono'
import { renderer } from './renderer'
import { FrameView } from '@/components/FrameView'

const app = new Hono()

app.use('*', renderer)

const SAMPLE_CODE = `function greet(name: string) {
  return \`Hello, \${name}!\`
}

console.log(greet('koma'))`

app.get('/', (c) =>
  c.render(
    <main>
      <FrameView code={SAMPLE_CODE} language="ts" />
    </main>,
    { title: 'koma — code into frames' },
  ),
)

export default app
