import { Decoration, type EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'

export const overflowRule = (maxChars: number) =>
  defineDecorationsPlugin((view: EditorView) => {
    const b = new RangeSetBuilder<Decoration>()
    const doc = view.state.doc

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i)
      if (line.length <= maxChars) continue

      b.add(
        line.from + maxChars,
        line.to,
        Decoration.mark({ class: 'cm-too-long' })
      )
    }

    return b.finish()
  })