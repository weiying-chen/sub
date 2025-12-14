import { Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'
import type { Finding } from '../analysis/types'

export function findingsDecorations(findings: Finding[]) {
  return defineDecorationsPlugin((view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()

    for (const v of findings) {
      if (v.type === 'MAX_CHARS') {
        // TS now KNOWS maxAllowed exists
        const line = view.state.doc.line(v.lineIndex + 1)

        builder.add(
          line.from + v.maxAllowed,
          line.to,
          Decoration.mark({ class: 'cm-too-long' })
        )
      }

      // future:
      // if (v.type === 'CPS') { ... }
    }

    return builder.finish()
  })
}
