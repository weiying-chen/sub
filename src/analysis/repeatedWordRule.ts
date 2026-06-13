import type { Rule, RuleCtx, RepeatedWordMetric } from "./types"
import type { SegmentCtx, SegmentRule } from "./segments"
import type { ParseBlockOptions, LineSource } from "../shared/tsvRuns"
import { parseBlockAt } from "../shared/tsvRuns"

type RepeatedWordRule = Rule & SegmentRule
type RepeatedWordRuleOptions = ParseBlockOptions

const WORD_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu

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
): RepeatedWordMetric[] {
  const metrics: RepeatedWordMetric[] = []
  let previousToken: string | null = null
  let previousWordIndex = -1

  WORD_RE.lastIndex = 0
  let match: RegExpExecArray | null = null
  while ((match = WORD_RE.exec(text))) {
    const token = match[0]
    const normalized = token.toLowerCase()

    if (previousToken === normalized && previousWordIndex >= 0) {
      metrics.push({
        type: "REPEATED_WORD",
        lineIndex: anchorIndex,
        index: match.index,
        token,
        text: fullText,
      })
    }

    previousToken = normalized
    previousWordIndex = match.index
  }

  return metrics
}

export function repeatedWordRule(
  options: RepeatedWordRuleOptions = {}
): RepeatedWordRule {
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
  }) as RepeatedWordRule
}
