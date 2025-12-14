import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'
import type { Finding } from '../analysis/types'

class CPSMarker extends WidgetType {
  toDOM() {
    const dot = document.createElement('span')
    dot.className = 'cm-cps-dot'
    dot.textContent = '•'
    return dot
  }

  ignoreEvent() {
    return true
  }
}

const cpsMarker = new CPSMarker()

export function findingsDecorations(findings: Finding[]) {
  return defineDecorationsPlugin((view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()

    // 🔴 CRITICAL FIX: ensure deterministic order
    const sorted = [...findings].sort((a, b) => {
      if (a.lineIndex !== b.lineIndex) {
        return a.lineIndex - b.lineIndex
      }

      // Same line: MAX_CHARS first, CPS last
      if (a.type === 'MAX_CHARS' && b.type === 'CPS') return -1
      if (a.type === 'CPS' && b.type === 'MAX_CHARS') return 1

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
      }

      if (f.type === 'CPS') {
        builder.add(
          line.to,
          line.to,
          Decoration.widget({
            widget: cpsMarker,
            side: 1,
          })
        )
      }
    }

    return builder.finish()
  })
}
