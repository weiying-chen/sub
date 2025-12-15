import type { Rule, MaxCharsMetric } from './types'

export const maxCharsRule = (maxChars: number): Rule => {
  return ({ line, lineIndex }) => {
    // Keep empty lines silent for now
    if (line.trim() === '') return []

    const metric: MaxCharsMetric = {
      type: 'MAX_CHARS',
      lineIndex,
      text: line,
      maxAllowed: maxChars,
      actual: line.length,
    }

    return [metric]
  }
}
