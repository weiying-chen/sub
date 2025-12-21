import { EditorView } from '@codemirror/view'

export const lightTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text)',
      backgroundColor: 'var(--bg)',
    },

    '.cm-scroller': {
      backgroundColor: 'var(--bg)',
    },

    '.cm-content': {
      caretColor: 'var(--text)',
      backgroundColor: 'var(--bg)',
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--text)',
    },

    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--cm-selection)',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--cm-gutter-bg)',
      color: 'var(--cm-gutter-text)',
      border: 'none',
    },
  },
  { dark: false }
)
