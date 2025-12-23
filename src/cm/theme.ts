// cm/theme.ts
import { EditorView } from "@codemirror/view"

export const cmTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text)",
      backgroundColor: "var(--bg)",
      border: "1px solid var(--border)",
      fontFamily: "var(--font-mono)",
      fontSize: "14px",
      lineHeight: "1.5",
    },

    ".cm-scroller": { backgroundColor: "var(--bg)" },
    ".cm-content": {
      backgroundColor: "var(--bg)",
      caretColor: "var(--text)",
      fontFamily: "var(--font-mono)",
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
      fontFamily: "var(--font-mono)",
    },
  },
  { dark: true }
)
