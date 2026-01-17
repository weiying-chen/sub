import type { Rule, CapitalizationMetric, RuleCtx } from './types'

import { type LineSource, parseBlockAt } from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type CapitalizationRule = Rule & SegmentRule

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

  const anchorIndex = block.payloadIndex ?? block.tsIndex
  return { text, anchorIndex }
}

function collectMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string
): CapitalizationMetric[] {
  const metrics: CapitalizationMetric[] = []
  const re = /\bindigenous\b/g
  let match: RegExpExecArray | null = null

  while ((match = re.exec(text))) {
    const token = match[0]
    metrics.push({
      type: 'CAPITALIZATION',
      lineIndex: anchorIndex,
      index: match.index,
      found: token,
      expected: 'Indigenous',
      token,
      text: fullText,
    })
  }

  return metrics
}

export function capitalizationRule(): CapitalizationRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(candidate.text, candidate.lineIndex, candidate.text)
      )
    }

    const extracted = getTextAndAnchor(ctx)
    if (!extracted) return []

    return collectMetrics(extracted.text, extracted.anchorIndex, extracted.text)
  }) as CapitalizationRule
}
