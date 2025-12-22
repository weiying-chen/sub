import { EditorView } from "@codemirror/view"

export const darkTheme = EditorView.theme(
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

    /* CodeMirror-drawn selection (THIS is the important one) */
    ".cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "var(--cm-selection)",
    },

    /* Native browser selection fallback */
    ".cm-content ::selection": {
      backgroundColor: "var(--cm-selection)",
    },

    ".cm-gutters": {
      backgroundColor: "var(--cm-gutter-bg)",
      color: "var(--cm-gutter-text)",
      border: "none",
    },
  },
  { dark: true }
)
