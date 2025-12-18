import type { EditorView } from '@codemirror/view'
import { extractInlineSubtitleText } from '../shared/subtitles'

export function getSelectedInlineText(view: EditorView): string {
  const { doc, selection } = view.state
  const parts: string[] = []

  for (const range of selection.ranges) {
    const fromLine = doc.lineAt(range.from).number - 1
    const toLine = doc.lineAt(range.to).number - 1

    for (let i = fromLine; i <= toLine; i++) {
      const text = extractInlineSubtitleText(doc.line(i + 1).text)
      if (text) parts.push(text)
    }
  }

  return parts.join(' ')
}
