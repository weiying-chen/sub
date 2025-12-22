
// cm/theme.ts
import { EditorView } from "@codemirror/view"

export const cmTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text)",
      backgroundColor: "var(--bg)",
      border: "1px solid var(--border)",
    },

    ".cm-scroller": { backgroundColor: "var(--bg)" },
    ".cm-content": {
      backgroundColor: "var(--bg)",
      caretColor: "var(--text)",
    },

    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--text)",
    },

    ".cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "var(--cm-selection)",
    },

    ".cm-gutters": {
      backgroundColor: "var(--cm-gutter-bg)",
      color: "var(--cm-gutter-text)",
      border: "none",
    },
  },
  { dark: true } // irrelevant, vars control everything
)
