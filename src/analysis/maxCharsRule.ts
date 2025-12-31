import type { Rule, MaxCharsMetric, RuleCtx } from './types'

import { type LineSource, parseBlockAt } from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type MaxCharsRule = Rule & SegmentRule

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx
): { text: string; anchorIndex: number } | null {
  if ('segment' in ctx) {
    const text = ctx.segment.text
    if (text.trim() === '') return null
    return { text, anchorIndex: ctx.segment.lineIndex }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? '',
  }

  const block = parseBlockAt(src, ctx.lineIndex)
  if (!block) return null

  const text = block.payloadText
  if (text.trim() === '') return null

  // Anchor the finding to the payload line when it exists.
  // If the payload only exists inline on the timestamp line, fall back to tsIndex.
  const anchorIndex = block.payloadIndex ?? block.tsIndex
  return { text, anchorIndex }
}

export const maxCharsRule = (maxChars: number): MaxCharsRule => {
  return ((ctx: RuleCtx | SegmentCtx) => {
    const extracted = getTextAndAnchor(ctx)
    if (!extracted) return []

    const metric: MaxCharsMetric = {
      type: 'MAX_CHARS',
      lineIndex: extracted.anchorIndex,
      text: extracted.text,
      maxAllowed: maxChars,
      actual: extracted.text.length,
    }

    return [metric]
  }) as MaxCharsRule
}
