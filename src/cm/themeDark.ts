import { EditorView } from '@codemirror/view'

export const darkTheme = EditorView.theme(
  {
    '&': {
      color: '#e5e7eb',           // text
      backgroundColor: '#111827', // gray-900 (softer than slate-900)
    },

    '.cm-scroller': {
      backgroundColor: '#111827',
    },

    '.cm-content': {
      caretColor: '#e5e7eb',
      backgroundColor: '#111827',
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#e5e7eb',
    },

    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#374151', // gray-700 (slightly softer than slate-700)
    },

    '.cm-gutters': {
      backgroundColor: '#0b1220', // softer than slate-950, not pitch black
      color: '#9ca3af',           // gray-400 for better readability
      border: 'none',
    },
  },
  { dark: true }
)
