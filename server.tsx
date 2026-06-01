import { Hono } from 'hono'
import { renderer } from './renderer'
import { App } from '@/components/App'
import type { Spec } from './src/model/types'

const app = new Hono()

app.use('*', renderer)

const SAMPLE: Spec = {
  language: 'php',
  frames: [
    {
      id: 'f1',
      code: `<?php

function beer() {`,
    },
    {
      id: 'f2',
      code: `<?php

function beer(string $name): string
{
    return "Cheers, {$name}!";
}`,
    },
    {
      id: 'f3',
      code: `<?php

function beer(string $name): string
{
    return "Cheers, {$name}!";
}

echo beer('P2B Haus');`,
    },
  ],
}

app.get('/', (c) =>
  c.render(
    <App initialSpec={SAMPLE} />,
    { title: 'piconic koma' },
  ),
)

export default app
