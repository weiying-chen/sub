import { EditorView, ViewPlugin } from "@codemirror/view"

export const selectLineOnTripleClick = ViewPlugin.fromClass(
  class {
    private view: EditorView
    private from = 0
    private to = 0
    private active = false

    private handler = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (e.detail < 3) return

      e.preventDefault()
      e.stopPropagation()
      ;(e as any).stopImmediatePropagation?.()

      // Only compute + dispatch on mousedown
      if (e.type !== "mousedown") return

      const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null) return

      const line = this.view.state.doc.lineAt(pos)
      this.from = line.from
      this.to = line.to
      this.active = true

      this.view.dispatch({
        selection: { anchor: this.from, head: this.to },
        userEvent: "select.pointer",
        scrollIntoView: true,
      })

      requestAnimationFrame(() => {
        if (!this.active) return
        const sel = this.view.state.selection.main
        if (sel.from === this.from && sel.to === this.to) return

        this.view.dispatch({
          selection: { anchor: this.from, head: this.to },
          userEvent: "select.pointer",
        })
      })
    }

    constructor(view: EditorView) {
      this.view = view
      // Capture phase: beat CM's handlers
      this.view.dom.addEventListener("mousedown", this.handler, true)
      this.view.dom.addEventListener("mouseup", this.handler, true)
      this.view.dom.addEventListener("click", this.handler, true)
    }

    destroy() {
      this.active = false
      this.view.dom.removeEventListener("mousedown", this.handler, true)
      this.view.dom.removeEventListener("mouseup", this.handler, true)
      this.view.dom.removeEventListener("click", this.handler, true)
    }
  }
)
