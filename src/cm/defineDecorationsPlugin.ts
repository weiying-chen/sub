import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type DecorationSet,
} from '@codemirror/view'

export const defineDecorationsPlugin = <Decs extends DecorationSet>(
  build: (view: EditorView) => Decs
) =>
  ViewPlugin.define(
    (view) => {
      let decorations = build(view)

      return {
        get decorations() {
          return decorations
        },
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            decorations = build(update.view)
          }
        },
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
