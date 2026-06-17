import type { Rule, RuleCtx, RepeatedPunctuationMetric } from "./types"
import type { SegmentCtx, SegmentRule } from "./segments"
import type { ParseBlockOptions, LineSource } from "../shared/tsvRuns"
import { parseBlockAt } from "../shared/tsvRuns"

type RepeatedPunctuationRule = Rule & SegmentRule
type RepeatedPunctuationRuleOptions = ParseBlockOptions

const REPEATED_PUNCTUATION_RE = /([,!?;:])\1+|\.{2,}/g

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
  fullText?: string
): RepeatedPunctuationMetric[] {
  const metrics: RepeatedPunctuationMetric[] = []

  REPEATED_PUNCTUATION_RE.lastIndex = 0
  let match: RegExpExecArray | null = null
  while ((match = REPEATED_PUNCTUATION_RE.exec(text))) {
    const token = match[0]
    if (token === "...") continue
    metrics.push({
      type: "REPEATED_PUNCTUATION",
      lineIndex: anchorIndex,
      index: match.index,
      token,
      text: fullText,
    })
  }

  return metrics
}

export function repeatedPunctuationRule(
  options: RepeatedPunctuationRuleOptions = {}
): RepeatedPunctuationRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ("segment" in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(candidate.lineText, candidate.lineIndex, candidate.lineText)
      )
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    return collectMetrics(extracted.text, extracted.anchorIndex, extracted.text)
  }) as RepeatedPunctuationRule
}
