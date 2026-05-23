'use client'

import { createSignal } from '@barefootjs/client'
import { Player } from '@/components/Player'
import { FrameEditor } from '@/components/FrameEditor'
import {
  addFrame,
  duplicateFrame,
  moveFrame,
  removeFrame,
  setLanguage,
  updateFrame,
} from '../src/model/spec'
import type { Language, Spec } from '../src/model/types'

interface AppProps {
  initialSpec: Spec
}

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'ts', label: 'TypeScript' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'js', label: 'JavaScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'py', label: 'Python' },
  { value: 'rs', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'rb', label: 'Ruby' },
  { value: 'pl', label: 'Perl' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sh', label: 'Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Plain text' },
]

// @bf-ignore props-destructuring
export function App({ initialSpec }: AppProps) {
  const [spec, setSpec] = createSignal<Spec>(initialSpec)

  const onLanguage = (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value as Language
    setSpec(s => setLanguage(s, v))
  }

  const onAdd = (index?: number) => setSpec(s => addFrame(s, index))

  return (
    <div className="koma-app">
      <header className="koma-app-header">
        <h1 className="koma-app-title">koma</h1>
        <label className="koma-lang-label">
          <span className="koma-lang-label-text">Language</span>
          <select
            className="koma-lang-select"
            value={spec().language}
            onChange={onLanguage}
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="koma-app-grid">
        <section className="koma-editors" aria-label="Frame editors">
          {spec().frames.map((frame, i) => (
            <FrameEditor
              key={frame.id}
              frame={frame}
              language={spec().language}
              index={i}
              total={spec().frames.length}
              onCode={code => setSpec(s => updateFrame(s, frame.id, { code }))}
              onHold={hold => setSpec(s => updateFrame(s, frame.id, { hold }))}
              onTransition={duration =>
                setSpec(s =>
                  updateFrame(s, frame.id, {
                    transition:
                      duration === undefined ? undefined : { duration },
                  }),
                )
              }
              onMoveUp={() => setSpec(s => moveFrame(s, frame.id, 'up'))}
              onMoveDown={() => setSpec(s => moveFrame(s, frame.id, 'down'))}
              onDuplicate={() => setSpec(s => duplicateFrame(s, frame.id))}
              onRemove={() => setSpec(s => removeFrame(s, frame.id))}
            />
          ))}

          <button
            type="button"
            className="koma-add-frame"
            onClick={() => onAdd()}
          >
            + Add frame
          </button>
        </section>

        <aside className="koma-preview" aria-label="Preview">
          <Player spec={spec()} />
        </aside>
      </div>
    </div>
  )
}
