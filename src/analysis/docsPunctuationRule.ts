import { punctuationRule } from './punctuationRule'
import type { Segment, SegmentCtx, SegmentRule } from './segments'
import type { Metric } from './types'

type DocsPunctuationRuleOptions = {
  properNouns?: string[]
  abbreviations?: string[]
}

type TimedTranslatedSegment = Segment & {
  startFrames: number
  endFrames: number
}

function isTimedTranslatedSegment(
  segment: Segment
): segment is TimedTranslatedSegment {
  return (
    typeof segment.startFrames === 'number' &&
    typeof segment.endFrames === 'number' &&
    segment.translation.trim() !== ''
  )
}

function selectDialogueSequence(segments: Segment[]): TimedTranslatedSegment[] {
  const candidates = segments
    .filter(isTimedTranslatedSegment)
    .sort(
      (left, right) =>
        left.endFrames - right.endFrames ||
        left.startFrames - right.startFrames ||
        (left.tsIndex ?? left.lineIndex) - (right.tsIndex ?? right.lineIndex)
    )

  const selected: TimedTranslatedSegment[] = []
  let previousEnd = -1
  for (const segment of candidates) {
    if (segment.startFrames < previousEnd) continue
    selected.push(segment)
    previousEnd = segment.endFrames
  }
  return selected.sort(
    (left, right) =>
      left.startFrames - right.startFrames || left.endFrames - right.endFrames
  )
}

export function docsPunctuationRule(
  options: DocsPunctuationRuleOptions = {}
): SegmentRule {
  const baseRule = punctuationRule({
    properNouns: options.properNouns,
    abbreviations: options.abbreviations,
    ignoreEmptyLines: true,
  }) as SegmentRule

  return (ctx: SegmentCtx): Metric[] => {
    if (ctx.segmentIndex !== 0) return []

    const sequence = selectDialogueSequence(ctx.segments)
    if (sequence.length === 0) return []

    const virtualLines: string[] = []
    const originalLineIndices = new Map<number, number>()
    for (const segment of sequence) {
      const timestampLineIndex = virtualLines.length
      virtualLines.push(
        ctx.lines?.[segment.tsIndex ?? -1] ??
          `00:00:00:00\t00:00:00:01\t${segment.sourceText ?? ''}`
      )
      const translationLineIndex = timestampLineIndex + 1
      virtualLines.push(segment.translation)
      originalLineIndices.set(translationLineIndex, segment.targetLines?.[0]?.lineIndex ?? segment.lineIndex)
    }

    return baseRule({
      ...ctx,
      lines: virtualLines,
    }).map((metric) => ({
      ...metric,
      lineIndex: originalLineIndices.get(metric.lineIndex) ?? metric.lineIndex,
    }))
  }
}
