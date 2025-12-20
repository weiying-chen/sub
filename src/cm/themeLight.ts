import { EditorView } from '@codemirror/view'

export const lightTheme = EditorView.theme(
  {
    '&': {
      color: '#111827',           // gray-900
      backgroundColor: '#ffffff',
    },

    '.cm-content': {
      caretColor: '#111827',
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#111827',
    },

    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#e5e7eb', // gray-200
    },

    '.cm-gutters': {
      backgroundColor: '#f9fafb', // gray-50
      color: '#6b7280',           // gray-500
      border: 'none',
    },
  },
  { dark: false }
)
