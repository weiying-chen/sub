import type { Rule } from './types'

export const maxCharsRule = (maxChars: number): Rule => {
  return ({ line, lineIndex }) => {
    if (line.length <= maxChars) return []

    return [{
      type: 'MAX_CHARS',
      lineIndex,
      text: line,
      maxAllowed: maxChars,
      actual: line.length,
    }]
  }
}
