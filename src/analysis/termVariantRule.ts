import type { Rule, RuleCtx, TermVariantMetric } from "./types"
import type { SegmentRule, SegmentCtx } from "./segments"
import type { ParseBlockOptions, LineSource } from "../shared/tsvRuns"
import { parseBlockAt } from "../shared/tsvRuns"

export type TermVariantEntry = {
  variant: string
  canonical: string
}

type TermVariantRule = Rule & SegmentRule
type TermVariantRuleOptions = ParseBlockOptions & {
  variants?: TermVariantEntry[]
}

type TermVariantMatcher = {
  re: RegExp
  canonical: string
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildMatchers(variants: TermVariantEntry[]): TermVariantMatcher[] {
  return variants
    .map((entry) => ({
      variant: entry.variant.trim(),
      canonical: entry.canonical.trim(),
    }))
    .filter((entry) => entry.variant !== "" && entry.canonical !== "")
    .map((entry) => ({
      re: new RegExp(`\\b${escapeRegExp(entry.variant)}\\b`, "gi"),
      canonical: entry.canonical,
    }))
}

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
): { text: string; anchorIndex: number } | null {
  if ("segment" in ctx) {
    const text = ctx.segment.translation
    if (text.trim() === "") return null
    return { text, anchorIndex: ctx.segment.lineIndex }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? "",
  }

  const block = parseBlockAt(src, ctx.lineIndex, options)
  if (!block) return null
  const text = block.translation
  if (text.trim() === "") return null
  const anchorIndex = block.translationIndex ?? block.tsIndex
  return { text, anchorIndex }
}

function collectMetrics(
  text: string,
  anchorIndex: number,
  matchers: TermVariantMatcher[],
  fullText?: string
): TermVariantMetric[] {
  const metrics: TermVariantMetric[] = []
  for (const matcher of matchers) {
    matcher.re.lastIndex = 0
    let match: RegExpExecArray | null = null
    while ((match = matcher.re.exec(text))) {
      const token = match[0]
      metrics.push({
        type: "TERM_VARIANT",
        lineIndex: anchorIndex,
        index: match.index,
        found: token,
        expected: matcher.canonical,
        token,
        text: fullText,
      })
    }
  }
  return metrics
}

export function termVariantRule(
  options: TermVariantRuleOptions = {}
): TermVariantRule {
  const variants = options.variants ?? []
  if (variants.length === 0) return (() => []) as TermVariantRule
  const matchers = buildMatchers(variants)

  return ((ctx: RuleCtx | SegmentCtx) => {
    if ("segment" in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(
          candidate.lineText,
          candidate.lineIndex,
          matchers,
          candidate.lineText
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
  }) as TermVariantRule
}
