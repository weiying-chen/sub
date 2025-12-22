import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  type DecorationSet,
} from "@codemirror/view"

export const defineDecorationsPlugin = <Decs extends DecorationSet>(
  build: (view: EditorView) => Decs
) =>
  ViewPlugin.fromClass(
    class {
      decorations: Decs

      constructor(view: EditorView) {
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
