export type TabIndentResult = {
  value: string
  cursor: number
}

export function applyTabIndent(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  indent = '  ',
): TabIndentResult {
  const next = value.slice(0, selectionStart) + indent + value.slice(selectionEnd)
  return { value: next, cursor: selectionStart + indent.length }
}
