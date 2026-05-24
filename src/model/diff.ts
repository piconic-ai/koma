// Line-level diff between consecutive frames.
//
// The output is a flat array of `LineRole`s — one entry per line of the
// union of prev/next — that downstream rendering uses to animate each
// line independently (keep = no motion, add = fade in, remove = fade out).
//
// Uses a standard LCS table for the diff. Tiny by design — we don't
// need move detection for the initial release (an add + remove pair is
// acceptable per the design doc) and avoiding the `diff` npm package
// keeps the client bundle free of bare-import resolution issues.

import type { Frame, LineRole } from './types'

export const splitLines = (code: string): string[] => code.split('\n')

type Change = {
  added?: boolean
  removed?: boolean
  value: string[]
}

function diffArrays(a: string[], b: string[]): Change[] {
  const m = a.length
  const n = b.length
  // LCS length table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  // Backtrack from (m, n)
  const ops: Array<{ kind: 'eq' | 'add' | 'remove'; value: string }> = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ kind: 'eq', value: a[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      // Prefer 'remove' first at ties so the output ordering matches
      // the conventional Myers/LCS bias (and our prior `diff` snapshot).
      ops.push({ kind: 'remove', value: a[i - 1] })
      i--
    } else {
      ops.push({ kind: 'add', value: b[j - 1] })
      j--
    }
  }
  while (i > 0) ops.push({ kind: 'remove', value: a[--i] })
  while (j > 0) ops.push({ kind: 'add', value: b[--j] })

  ops.reverse()

  // Group runs of the same kind so downstream code matches the shape
  // it used to consume from `diff.diffArrays`.
  const changes: Change[] = []
  for (const op of ops) {
    const last = changes[changes.length - 1]
    const sameRun =
      last &&
      ((op.kind === 'eq' && !last.added && !last.removed) ||
        (op.kind === 'add' && last.added === true) ||
        (op.kind === 'remove' && last.removed === true))
    if (sameRun) {
      last.value.push(op.value)
    } else {
      changes.push({
        added: op.kind === 'add' || undefined,
        removed: op.kind === 'remove' || undefined,
        value: [op.value],
      })
    }
  }
  return changes
}

function commonPrefixLength(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let i = 0
  while (i < len && a[i] === b[i]) i++
  return i
}

export function computeLineRoles(prev: Frame, next: Frame): LineRole[] {
  const prevLines = splitLines(prev.code)
  const nextLines = splitLines(next.code)

  const changes = diffArrays(prevLines, nextLines)
  const roles: LineRole[] = []

  let fromIdx = 0
  let toIdx = 0

  for (let ci = 0; ci < changes.length; ci++) {
    const change = changes[ci]

    if (change.removed) {
      const nextChange = changes[ci + 1]
      if (nextChange?.added) {
        const removeLines = change.value
        const addLines = nextChange.value
        const paired = Math.min(removeLines.length, addLines.length)

        for (let k = 0; k < paired; k++) {
          const oldLine = removeLines[k]
          const newLine = addLines[k]
          const prefix = commonPrefixLength(oldLine, newLine)
          if (prefix > 0 && (oldLine !== newLine)) {
            roles.push({
              type: 'modify',
              line: newLine,
              oldLine,
              commonPrefix: prefix,
              fromIndex: fromIdx++,
              toIndex: toIdx++,
            })
          } else {
            roles.push({ type: 'remove', line: oldLine, fromIndex: fromIdx++ })
            roles.push({ type: 'add', line: newLine, toIndex: toIdx++ })
          }
        }
        for (let k = paired; k < removeLines.length; k++) {
          roles.push({ type: 'remove', line: removeLines[k], fromIndex: fromIdx++ })
        }
        for (let k = paired; k < addLines.length; k++) {
          roles.push({ type: 'add', line: addLines[k], toIndex: toIdx++ })
        }
        ci++
      } else {
        for (const line of change.value) {
          roles.push({ type: 'remove', line, fromIndex: fromIdx++ })
        }
      }
    } else if (change.added) {
      const nextChange = changes[ci + 1]
      if (nextChange?.removed) {
        const addLines = change.value
        const removeLines = nextChange.value
        const paired = Math.min(removeLines.length, addLines.length)

        for (let k = 0; k < paired; k++) {
          const oldLine = removeLines[k]
          const newLine = addLines[k]
          const prefix = commonPrefixLength(oldLine, newLine)
          if (prefix > 0 && (oldLine !== newLine)) {
            roles.push({
              type: 'modify',
              line: newLine,
              oldLine,
              commonPrefix: prefix,
              fromIndex: fromIdx++,
              toIndex: toIdx++,
            })
          } else {
            roles.push({ type: 'remove', line: oldLine, fromIndex: fromIdx++ })
            roles.push({ type: 'add', line: newLine, toIndex: toIdx++ })
          }
        }
        for (let k = paired; k < addLines.length; k++) {
          roles.push({ type: 'add', line: addLines[k], toIndex: toIdx++ })
        }
        for (let k = paired; k < removeLines.length; k++) {
          roles.push({ type: 'remove', line: removeLines[k], fromIndex: fromIdx++ })
        }
        ci++
      } else {
        for (const line of change.value) {
          roles.push({ type: 'add', line, toIndex: toIdx++ })
        }
      }
    } else {
      for (const line of change.value) {
        roles.push({
          type: 'keep',
          line,
          fromIndex: fromIdx++,
          toIndex: toIdx++,
        })
      }
    }
  }

  return roles
}
