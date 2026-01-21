import type { Rule, PercentStyleMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type PercentStyleRule = Rule & SegmentRule

function collectMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string
): PercentStyleMetric[] {
  const metrics: PercentStyleMetric[] = []
  const digitsRe = /\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\b/g
  let match: RegExpExecArray | null = null

  while ((match = digitsRe.exec(text))) {
    const rawToken = match[0]
    const normalized = rawToken.replace(/,/g, '')
    const value = Number.parseFloat(normalized)
    if (!Number.isFinite(value)) continue

    const tail = text.slice(match.index + rawToken.length)
    const percentWordMatch = tail.match(/^\s+percent\b/i)
    if (!percentWordMatch) continue

    metrics.push({
      type: 'PERCENT_STYLE',
      lineIndex: anchorIndex,
      index: match.index,
      value,
      found: 'word',
      expected: 'symbol',
      token: `${rawToken}${percentWordMatch[0]}`,
      text: fullText,
    })
  }

  return metrics
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

export function percentStyleRule(
  options: ParseBlockOptions = {}
): PercentStyleRule {
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
  }) as PercentStyleRule
}
