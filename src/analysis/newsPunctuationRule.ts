import type { PunctuationMetric } from './types'
import type { SegmentCtx, SegmentRule } from './segments'
import { endsSentenceBoundary, startsWithOpenQuote } from './punctuationShared'

export function newsPunctuationRule(): SegmentRule {
  return (ctx: SegmentCtx): PunctuationMetric[] => {
    const { segment } = ctx
    if (segment.blockType !== 'vo' && segment.blockType !== 'super') return []
    const lines = segment.targetLines ?? []
    if (lines.length < 2) return []

    const metrics: PunctuationMetric[] = []

    for (let i = 0; i < lines.length - 1; i += 1) {
      const prev = lines[i]
      const next = lines[i + 1]
      const prevTrim = prev.lineText.trimEnd()

      if (
        prevTrim.endsWith(',') &&
        !prevTrim.endsWith(':') &&
        !endsSentenceBoundary(prevTrim) &&
        startsWithOpenQuote(next.lineText) !== null
      ) {
        metrics.push({
          type: 'PUNCTUATION',
          lineIndex: prev.lineIndex,
          ruleCode: 'COMMA_BEFORE_QUOTE',
          instruction: "End this translation with ':' before the next quoted translation.",
          text: prev.lineText,
          nextText: next.lineText,
        })
      }
    }

    return metrics
  }
}
