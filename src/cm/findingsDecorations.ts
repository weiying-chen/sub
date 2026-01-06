import { Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'
import type { Finding } from '../analysis/types'

export function findingsDecorations(findings: Finding[]) {
  return defineDecorationsPlugin((view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()

    // Still keep deterministic order (useful if you add more decorations later)
    const sorted = [...findings].sort((a, b) => {
      if (a.lineIndex !== b.lineIndex) {
        return a.lineIndex - b.lineIndex
      }

      const isCpsFinding = (f: Finding) =>
        f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS'

      // Same line: MAX_CHARS first, CPS last
      if (a.type === 'MAX_CHARS' && isCpsFinding(b)) return -1
      if (isCpsFinding(a) && b.type === 'MAX_CHARS') return 1

      return 0
    })

    for (const f of sorted) {
      const line = view.state.doc.line(f.lineIndex + 1)

      if (f.type === 'MAX_CHARS') {
        builder.add(
          line.from + f.maxAllowed,
          line.to,
          Decoration.mark({ class: 'cm-too-long' })
        )
        continue
      }

      // CPS dot removed. CPS is now communicated via the gutter line color.
    }

    return builder.finish()
  })
}
