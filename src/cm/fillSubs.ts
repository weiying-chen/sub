import type { EditorView } from '@codemirror/view'
import {
  fillSelectedTimestampLines,
  type FillSubsOptions,
} from '../shared/fillSubs'

function getSelectedLineIndices(view: EditorView): Set<number> {
  const { doc, selection } = view.state
  const selected = new Set<number>()

  for (const range of selection.ranges) {
    const fromLine = doc.lineAt(range.from).number - 1
    const toLine = doc.lineAt(range.to).number - 1

    for (let i = fromLine; i <= toLine; i++) {
      selected.add(i)
    }
  }

  return selected
}

export function fillSelectedTimestampSubs(
  view: EditorView,
  paragraph: string,
  options?: FillSubsOptions
): { remaining: string } {
  const docText = view.state.doc.toString()
  const hasTrailingNewline = docText.endsWith('\n')
  const lines = docText.split(/\r?\n/)
  const selectedLineIndices = getSelectedLineIndices(view)

  const result = fillSelectedTimestampLines(
    lines,
    selectedLineIndices,
    paragraph,
    options
  )

  let nextText = result.lines.join('\n')
  if (hasTrailingNewline && !nextText.endsWith('\n')) {
    nextText += '\n'
  }

  if (nextText !== docText) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextText },
    })
  }

  return { remaining: result.remaining }
}
