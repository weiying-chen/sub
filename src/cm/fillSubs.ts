import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import {
  fillSelectedTimestampLines,
  type FillSubsOptions,
} from '../shared/fillSubs'
import { TSV_RE } from '../shared/subtitles'
import abbreviationsText from '../../punctuation-abbreviations.txt?raw'

function parseTextList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

const noSplitAbbreviations = parseTextList(abbreviationsText)

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

function getOffsetAtLineEnd(lines: string[], lineIndex: number): number {
  let offset = 0
  for (let i = 0; i < lineIndex; i += 1) {
    offset += (lines[i]?.length ?? 0) + 1
  }
  return offset + (lines[lineIndex]?.length ?? 0)
}

function getFilledBlockEndOffset(
  originalLines: string[],
  selectedLineIndices: Set<number>,
  filledLines: string[],
  fallback: number
): number {
  const selectedTimestampLines = originalLines.filter((line, index) => {
    return selectedLineIndices.has(index) && TSV_RE.test(line)
  })
  if (selectedTimestampLines.length === 0) return fallback

  let selectedTimestampIndex = 0
  let lastMatchedLineIndex = -1
  for (let i = 0; i < filledLines.length; i += 1) {
    if (filledLines[i] !== selectedTimestampLines[selectedTimestampIndex]) continue
    lastMatchedLineIndex = i
    selectedTimestampIndex += 1
    if (selectedTimestampIndex >= selectedTimestampLines.length) break
  }
  if (lastMatchedLineIndex < 0) return fallback

  let endLineIndex = lastMatchedLineIndex
  for (let i = lastMatchedLineIndex + 1; i < filledLines.length; i += 1) {
    const line = filledLines[i] ?? ''
    if (line.trim() === '' || TSV_RE.test(line)) break
    endLineIndex = i
  }

  return getOffsetAtLineEnd(filledLines, endLineIndex)
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
    {
      ...options,
      noSplitAbbreviations: options?.noSplitAbbreviations ?? noSplitAbbreviations,
    }
  )
  if (typeof result.chosenCps === 'number') {
    console.log('[fillSubs] chosenCps', result.chosenCps.toFixed(2))
  }

  let nextText = result.lines.join('\n')
  if (hasTrailingNewline && !nextText.endsWith('\n')) {
    nextText += '\n'
  }

  if (nextText !== docText) {
    const cursor = Math.min(
      getFilledBlockEndOffset(
        lines,
        selectedLineIndices,
        nextText.split('\n'),
        view.state.selection.main.from
      ),
      nextText.length
    )
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextText },
      selection: EditorSelection.cursor(cursor),
    })
  }

  return { remaining: result.remaining }
}
