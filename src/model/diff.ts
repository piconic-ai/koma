// Line-level diff between consecutive frames.
//
// The output is a flat array of `LineRole`s — one entry per line of the
// union of prev/next — that downstream rendering uses to animate each
// line independently (keep = no motion, add = fade in, remove = fade out).
//
// We rely on `diff.diffArrays` which is a standard Myers implementation.
// "Move" is not detected here on purpose; the design doc keeps initial
// scope tight (an add + a remove is acceptable) and revisits if the
// authored videos call for it.

import { diffArrays } from 'diff'
import type { Frame, LineRole } from './types'

export const splitLines = (code: string): string[] => code.split('\n')

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
