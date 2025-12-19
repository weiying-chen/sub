import type { Rule, MaxCharsMetric } from './types'

import { type LineSource, parseBlockAt } from '../shared/tsvRuns'

export const maxCharsRule = (maxChars: number): Rule => {
  return ({ lineIndex, lines }) => {
    const src: LineSource = {
      lineCount: lines.length,
      getLine: (i) => lines[i] ?? '',
    }

    const block = parseBlockAt(src, lineIndex)
    if (!block) return []

    const text = block.payloadText
    if (text.trim() === '') return []

    // Anchor the finding to the payload line when it exists.
    // If the payload only exists inline on the timestamp line, fall back to tsIndex.
    const anchorIndex = block.payloadIndex ?? block.tsIndex

    const metric: MaxCharsMetric = {
      type: 'MAX_CHARS',
      lineIndex: anchorIndex,
      text,
      maxAllowed: maxChars,
      actual: text.length,
    }

    return [metric]
  }
}
