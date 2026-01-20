import type { Rule, CapitalizationMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type CapitalizationRule = Rule & SegmentRule
type CapitalizationRuleOptions = ParseBlockOptions & {
  terms?: string[]
}

type CapitalizationMatcher = {
  re: RegExp
  expected: string
}

const DEFAULT_TERMS = ['Indigenous', 'Bodhisattva', 'Bodhisattvas']

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildMatchers(terms: string[]): CapitalizationMatcher[] {
  const cleaned = terms
    .map((term) => term.trim())
    .filter((term) => term !== '')

  return cleaned.map((term) => ({
    re: new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'g'),
    expected: term,
  }))
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

function collectMetrics(
  text: string,
  anchorIndex: number,
  matchers: CapitalizationMatcher[],
  fullText?: string
): CapitalizationMetric[] {
  const metrics: CapitalizationMetric[] = []

  for (const matcher of matchers) {
    matcher.re.lastIndex = 0
    let match: RegExpExecArray | null = null
    while ((match = matcher.re.exec(text))) {
      const token = match[0]
      metrics.push({
        type: 'CAPITALIZATION',
        lineIndex: anchorIndex,
        index: match.index,
        found: token,
        expected: matcher.expected,
        token,
        text: fullText,
      })
    }
  }

  return metrics
}

export function capitalizationRule(
  options: CapitalizationRuleOptions = {}
): CapitalizationRule {
  const terms =
    options.terms && options.terms.length > 0 ? options.terms : DEFAULT_TERMS
  const matchers = buildMatchers(terms)
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(
          candidate.text,
          candidate.lineIndex,
          matchers,
          candidate.text
        )
      )
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    return collectMetrics(
      extracted.text,
      extracted.anchorIndex,
      matchers,
      extracted.text
    )
  }) as CapitalizationRule
}
