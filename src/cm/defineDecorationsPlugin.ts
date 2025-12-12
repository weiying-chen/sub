import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

export const defineDecorationsPlugin = <Decs>(
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
    { decorations: (v: any) => v.decorations }
  )