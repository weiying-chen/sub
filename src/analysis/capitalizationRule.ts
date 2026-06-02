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

const KINSHIP_TITLE_MATCHERS: CapitalizationMatcher[] = [
  { re: /\bgrandma\b/gi, expected: 'Grandma' },
  { re: /\bgrandpa\b/gi, expected: 'Grandpa' },
]

const DESCRIPTIVE_KINSHIP_PREFIX_RE =
  /\b(?:my|your|his|her|our|their|a|an|the|this|that|one|someone's|somebody's)\s+$/i
const KINSHIP_TITLE_POSITION_RE = /^\s*(?:["'([{]\s*)*$/

function isKinshipTitlePosition(text: string, index: number): boolean {
  return KINSHIP_TITLE_POSITION_RE.test(text.slice(0, index))
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildMatchers(terms: string[]): CapitalizationMatcher[] {
  const cleaned = terms
    .map((term) => term.trim())
    .filter((term) => term !== '')

  return cleaned.map((term) => ({
    re: new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'),
    expected: term,
  }))
}

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
): { text: string; anchorIndex: number } | null {
  if ('segment' in ctx) {
    const text = ctx.segment.translation
    if (text.trim() === '') return null
    return { text, anchorIndex: ctx.segment.lineIndex }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? '',
  }

  const block = parseBlockAt(src, ctx.lineIndex, options)
  if (!block) return null

  const text = block.translation
  if (text.trim() === '') return null

  const anchorIndex = block.translationIndex ?? block.tsIndex
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
      if (token === matcher.expected) continue
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

function collectKinshipMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string
): CapitalizationMetric[] {
  const metrics: CapitalizationMetric[] = []

  for (const matcher of KINSHIP_TITLE_MATCHERS) {
    matcher.re.lastIndex = 0
    let match: RegExpExecArray | null = null
    while ((match = matcher.re.exec(text))) {
      const token = match[0]
      if (token === matcher.expected) continue
      if (!isKinshipTitlePosition(text, match.index)) continue
      const before = text.slice(0, match.index)
      if (DESCRIPTIVE_KINSHIP_PREFIX_RE.test(before)) continue
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

function collectAllMetrics(
  text: string,
  anchorIndex: number,
  matchers: CapitalizationMatcher[],
  fullText?: string
): CapitalizationMetric[] {
  return [
    ...collectMetrics(text, anchorIndex, matchers, fullText),
    ...collectKinshipMetrics(text, anchorIndex, fullText),
  ]
}

export function capitalizationRule(
  options: CapitalizationRuleOptions = {}
): CapitalizationRule {
  const terms = options.terms ?? []
  const matchers = buildMatchers(terms)
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectAllMetrics(
          candidate.lineText,
          candidate.lineIndex,
          matchers,
          candidate.lineText
        )
      )
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    return collectAllMetrics(
      extracted.text,
      extracted.anchorIndex,
      matchers,
      extracted.text
    )
  }) as CapitalizationRule
}
