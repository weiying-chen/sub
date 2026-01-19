import type { Rule, MaxCharsMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import type { Segment, SegmentCtx, SegmentRule } from './segments'

type MaxCharsRule = Rule & SegmentRule

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
): { text: string; anchorIndex: number } | null {
  if ('segment' in ctx) {
    const seg = ctx.segment as Segment
    if (seg.blockType === 'vo') return null
    if (seg.blockType === 'super') {
      const candidates = seg.targetLines?.length
        ? seg.targetLines
        : [{ lineIndex: seg.lineIndex, text: seg.text }]
      const first = candidates.find((candidate) => candidate.text.trim() !== '')
      if (!first) return null
      return { text: first.text, anchorIndex: first.lineIndex }
    }
    if (
      typeof seg.startFrames !== 'number' ||
      typeof seg.endFrames !== 'number'
    ) {
      return null
    }

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

  // Anchor the finding to the payload line when it exists.
  // If the payload only exists inline on the timestamp line, fall back to tsIndex.
  const anchorIndex = block.payloadIndex ?? block.tsIndex
  return { text, anchorIndex }
}

export const maxCharsRule = (
  maxChars: number,
  options: ParseBlockOptions = {}
): MaxCharsRule => {
  return ((ctx: RuleCtx | SegmentCtx) => {
    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    if ('segment' in ctx && ctx.segment.blockType === 'super') {
      const candidates = ctx.segment.targetLines?.length
        ? ctx.segment.targetLines
        : [{ lineIndex: extracted.anchorIndex, text: extracted.text }]
      return candidates
        .filter((candidate) => candidate.text.trim() !== '')
        .map(
          (candidate): MaxCharsMetric => ({
            type: 'MAX_CHARS',
            lineIndex: candidate.lineIndex,
            text: candidate.text,
            maxAllowed: maxChars,
            actual: candidate.text.length,
          })
        )
    }

    const metric: MaxCharsMetric = {
      type: 'MAX_CHARS',
      lineIndex: extracted.anchorIndex,
      text: extracted.text,
      maxAllowed: maxChars,
      actual: extracted.text.length,
    }

    return [metric]
  }) as MaxCharsRule
}
