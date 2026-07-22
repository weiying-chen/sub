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

function collectBoundaryMetric(
  leftText: string,
  rightText: string,
  rightAnchorIndex: number
): RepeatedPunctuationMetric[] {
  const left = leftText.trimEnd()
  const right = rightText.trimStart()
  const leftToken = left.at(-1)
  const rightToken = right[0]
  if (!leftToken || leftToken !== rightToken) return []
  if (!/[,!?;:.]/.test(leftToken)) return []

  return [
    {
      type: "REPEATED_PUNCTUATION",
      lineIndex: rightAnchorIndex,
      index: rightText.search(/\S/),
      token: `${leftToken}${rightToken}`,
      text: rightText,
    },
  ]
}

export function repeatedPunctuationRule(
  options: RepeatedPunctuationRuleOptions = {}
): RepeatedPunctuationRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ("segment" in ctx && ctx.segment.suppressSuggestions) return []

    if ("segment" in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      const metrics = candidates.flatMap((candidate) =>
        collectMetrics(candidate.lineText, candidate.lineIndex, candidate.lineText)
      )

      for (let i = 1; i < candidates.length; i += 1) {
        const left = candidates[i - 1]
        const right = candidates[i]
        metrics.push(...collectBoundaryMetric(left.lineText, right.lineText, right.lineIndex))
      }

      const previousSegment = ctx.segments[ctx.segmentIndex - 1]
      if (previousSegment && !previousSegment.suppressSuggestions) {
        const previousText = previousSegment.targetLines?.at(-1)?.lineText
          ?? previousSegment.translation
        const first = candidates[0]
        metrics.push(
          ...collectBoundaryMetric(previousText, first.lineText, first.lineIndex)
        )
      }

      return metrics
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    return collectMetrics(extracted.text, extracted.anchorIndex, extracted.text)
  }) as RepeatedPunctuationRule
}
