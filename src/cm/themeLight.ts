import { EditorView } from "@codemirror/view"

export const lightTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text)",
      backgroundColor: "var(--bg)",
    },

    ".cm-scroller": {
      backgroundColor: "var(--bg)",
    },

    ".cm-content": {
      caretColor: "var(--text)",
      backgroundColor: "var(--bg)",
    },

    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--text)",
    },

    /* CodeMirror-drawn selection */
    ".cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "var(--cm-selection)",
    },

    /* Native browser selection fallback (scoped) */
    ".cm-content ::selection": {
      backgroundColor: "var(--cm-selection)",
    },

    ".cm-gutters": {
      backgroundColor: "var(--cm-gutter-bg)",
      color: "var(--cm-gutter-text)",
      border: "none",
    },
  },
  { dark: false }
)
