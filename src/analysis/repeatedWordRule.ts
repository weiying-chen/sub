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

function collectBoundaryMetric(
  leftText: string,
  rightText: string,
  rightAnchorIndex: number
): RepeatedWordMetric[] {
  if (!/[\p{L}\p{N}]$/u.test(leftText.trimEnd())) return []
  if (!/^[\p{L}\p{N}]/u.test(rightText.trimStart())) return []

  const leftWords = Array.from(leftText.matchAll(WORD_RE))
  const rightWord = Array.from(rightText.matchAll(WORD_RE))[0]
  const leftWord = leftWords[leftWords.length - 1]
  if (!leftWord || !rightWord) return []
  if (leftWord[0].toLowerCase() !== rightWord[0].toLowerCase()) return []

  return [
    {
      type: "REPEATED_WORD",
      lineIndex: rightAnchorIndex,
      index: rightWord.index,
      token: rightWord[0],
      text: rightText,
    },
  ]
}

export function repeatedWordRule(
  options: RepeatedWordRuleOptions = {}
): RepeatedWordRule {
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
  }) as RepeatedWordRule
}
