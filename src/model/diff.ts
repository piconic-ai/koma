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

export function computeLineRoles(prev: Frame, next: Frame): LineRole[] {
  const prevLines = splitLines(prev.code)
  const nextLines = splitLines(next.code)

  const changes = diffArrays(prevLines, nextLines)
  const roles: LineRole[] = []

  let fromIdx = 0
  let toIdx = 0

  for (const change of changes) {
    if (change.added) {
      for (const line of change.value) {
        roles.push({ type: 'add', line, toIndex: toIdx++ })
      }
    } else if (change.removed) {
      for (const line of change.value) {
        roles.push({ type: 'remove', line, fromIndex: fromIdx++ })
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
