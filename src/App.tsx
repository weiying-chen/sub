import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const MAX_CHARS = 10

const highlightOverflow = ViewPlugin.fromClass(
  class {
    decorations: any

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view)
      }
    }

    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc

      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i)
        if (line.length <= MAX_CHARS) continue

        // Highlight only the overflow range (after MAX_CHARS)
        const from = line.from + MAX_CHARS
        const to = line.to

        builder.add(from, to, Decoration.mark({ class: 'cm-too-long' }))
      }

      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

export default function App() {
  const [value, setValue] = useState(
    'This line is short.\n' +
      'This line is definitely going to exceed fifty-five characters easily.\n'
  )

  const extensions = useMemo(() => [highlightOverflow], [])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CodeMirror
        value={value}
        onChange={setValue}
        height="100vh"
        width="100vw"
        basicSetup={{ lineWrapping: true, drawSelection: false }}
        extensions={extensions}
      />
    </div>
  )
}