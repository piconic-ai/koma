import { Hono } from 'hono'
import { renderer } from './renderer'
import { Counter } from '@/components/Counter'

const app = new Hono()

app.use('*', renderer)

app.get('/', (c) =>
  c.render(
    <main>
      <Counter />
    </main>,
    { title: 'BarefootJS app' },
  ),
)

export default app
