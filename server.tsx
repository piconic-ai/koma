import { Hono } from 'hono'
import { renderer } from './renderer'
import { App } from '@/components/App'
import type { Spec } from './src/model/types'

const app = new Hono()

app.use('*', renderer)

const SAMPLE: Spec = {
  language: 'ts',
  frames: [
    {
      id: 'f1',
      code: `function greet() {`,
    },
    {
      id: 'f2',
      code: `function greet(name: string) {
  return \`Hello, \${name}!\`
}`,
    },
    {
      id: 'f3',
      code: `function greet(name: string) {
  return \`Hello, \${name}!\`
}

console.log(greet('koma'))`,
    },
  ],
}

app.get('/', (c) =>
  c.render(
    <App initialSpec={SAMPLE} />,
    { title: 'koma — code into frames' },
  ),
)

export default app
