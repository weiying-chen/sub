import type { Rule, LeadingWhitespaceMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type LeadingWhitespaceRule = Rule & SegmentRule

function collectMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string
): LeadingWhitespaceMetric[] {
  if (text.trim() === '') return []
  const match = text.match(/^\s+/)
  if (!match) return []

  return [
    {
      type: 'LEADING_WHITESPACE',
      lineIndex: anchorIndex,
      index: 0,
      count: match[0].length,
      text: fullText,
    },
  ]
}

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
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

  const block = parseBlockAt(src, ctx.lineIndex, options)
  if (!block) return null

  const text = block.payloadText
  if (text.trim() === '') return null

  const anchorIndex = block.payloadIndex ?? block.tsIndex
  return { text, anchorIndex }
}

export function leadingWhitespaceRule(
  options: ParseBlockOptions = {}
): LeadingWhitespaceRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(candidate.text, candidate.lineIndex, candidate.text)
      )
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    return collectMetrics(extracted.text, extracted.anchorIndex, extracted.text)
  }) as LeadingWhitespaceRule
}
