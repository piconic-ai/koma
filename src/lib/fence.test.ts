import { describe, test, expect } from 'bun:test'
import { parseFence } from './fence'

describe('parseFence', () => {
  test('returns null without a trailing newline (still typing the fence)', () => {
    expect(parseFence('```typescript')).toBeNull()
  })

  test('parses a backtick fence and strips the fence line', () => {
    const r = parseFence('```typescript\nfunction greet() {')
    expect(r).not.toBeNull()
    expect(r!.language).toBe('ts')
    expect(r!.rest).toBe('function greet() {')
  })

  test('resolves common aliases', () => {
    expect(parseFence('```py\nx = 1')!.language).toBe('py')
    expect(parseFence('```rust\nfn main() {}')!.language).toBe('rs')
    expect(parseFence('```c#\nvar x = 1;')!.language).toBe('cs')
    expect(parseFence('```c++\nint x;')!.language).toBe('cpp')
    expect(parseFence('```bash\necho hi')!.language).toBe('sh')
  })

  test('accepts tilde fences too', () => {
    expect(parseFence('~~~go\npackage main')!.language).toBe('go')
  })

  test('is case-insensitive on the info string', () => {
    expect(parseFence('```TypeScript\nconst x = 1')!.language).toBe('ts')
  })

  test('empty or "auto" info resets to Auto (undefined language)', () => {
    expect(parseFence('```\ncode')).toEqual({ language: undefined, rest: 'code' })
    expect(parseFence('```auto\ncode')).toEqual({ language: undefined, rest: 'code' })
  })

  test('returns null for an unrecognized info string', () => {
    expect(parseFence('```cobol\nfoo')).toBeNull()
  })

  test('returns null when the first line is not a fence', () => {
    expect(parseFence('function greet() {\n  return 1\n}')).toBeNull()
  })

  test('keeps the remaining lines intact', () => {
    const r = parseFence('```ts\nline1\nline2\n')
    expect(r!.rest).toBe('line1\nline2\n')
  })
})
