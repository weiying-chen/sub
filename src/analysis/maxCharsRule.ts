import type { Rule, MaxCharsMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import { stripCpsSuppressionMarker } from '../shared/cpsSuppression'
import type { CandidateLine, Segment, SegmentCtx, SegmentRule } from './segments'

type MaxCharsRule = Rule & SegmentRule

function toMaxCharsMetric(
  lineIndex: number,
  lineText: string,
  maxChars: number
): MaxCharsMetric {
  const cleaned = stripCpsSuppressionMarker(lineText)
  return {
    type: 'MAX_CHARS',
    lineIndex,
    text: cleaned.text,
    maxAllowed: maxChars,
    actual: cleaned.text.length,
  }
}

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
): { text: string; anchorIndex: number; lines: CandidateLine[] } | null {
  if ('segment' in ctx) {
    const seg = ctx.segment as Segment
    if (
      typeof seg.startFrames !== 'number' ||
      typeof seg.endFrames !== 'number'
    ) {
      const candidates = seg.targetLines?.length
        ? seg.targetLines
        : [{ lineIndex: seg.lineIndex, lineText: seg.translation }]
      const first = candidates.find((candidate) => candidate.lineText.trim() !== '')
      if (!first) return null
      return { text: first.lineText, anchorIndex: first.lineIndex, lines: candidates }
    }

    const text = ctx.segment.translation
    if (text.trim() === '') return null
    const lines = ctx.segment.targetLines?.length
      ? ctx.segment.targetLines
      : [{ lineIndex: ctx.segment.lineIndex, lineText: text }]
    return { text, anchorIndex: ctx.segment.lineIndex, lines }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? '',
  }

  const block = parseBlockAt(src, ctx.lineIndex, options)
  if (!block) return null

  const text = block.translation
  if (text.trim() === '') return null

  // Anchor the finding to the translation line when it exists.
  // If the translation only exists source text on the timestamp line, fall back to tsIndex.
  const anchorIndex = block.translationIndex ?? block.tsIndex
  const lines = block.translationIndices.map((lineIndex, idx) => ({
    lineIndex,
    lineText: block.translationLines[idx] ?? '',
  }))
  return { text, anchorIndex, lines }
}

export const maxCharsRule = (
  maxChars: number,
  options: ParseBlockOptions = {}
): MaxCharsRule => {
  return ((ctx: RuleCtx | SegmentCtx) => {
    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    if (
      'segment' in ctx &&
      typeof ctx.segment.startFrames !== 'number' &&
      typeof ctx.segment.endFrames !== 'number'
    ) {
      const candidates = ctx.segment.targetLines?.length
        ? ctx.segment.targetLines
        : [{ lineIndex: extracted.anchorIndex, lineText: extracted.text }]
      return candidates
        .filter((candidate) => candidate.lineText.trim() !== '')
        .map((candidate) =>
          toMaxCharsMetric(candidate.lineIndex, candidate.lineText, maxChars)
        )
    }

    return extracted.lines
      .filter((line) => line.lineText.trim() !== '')
      .map((line) => toMaxCharsMetric(line.lineIndex, line.lineText, maxChars))
  }) as MaxCharsRule
}
