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

const TITLE_CONNECTORS = new Set([
  'a',
  'an',
  'and',
  'by',
  'for',
  'in',
  'of',
  'the',
  'to',
])

function titleWords(text: string): string[] {
  return text.match(/[A-Za-z]+(?:-[A-Za-z]+)*/g) ?? []
}

function isMetadataLabel(text: string): boolean {
  const label = text.split(':', 1)[0]?.trim() ?? ''
  if (label === '' || !text.includes(':')) return false
  return isTitleCaseLine(label) && titleWords(label).length >= 2
}

function isTitleCaseLine(text: string): boolean {
  if (/[.!?]$/.test(text.trim())) return false
  const words = titleWords(text)
  if (words.length === 0) return false
  return words.every((word) => {
    if (TITLE_CONNECTORS.has(word.toLowerCase())) return true
    return /^[A-Z][A-Za-z]*(?:-[a-z]+)*$/.test(word)
  })
}

function isSentenceCaseRoleLine(text: string): boolean {
  if (/[.!?]$/.test(text.trim())) return false
  const words = titleWords(text)
  if (words.length < 2) return false
  const role = words.at(-1) ?? ''
  if (!/^[a-z][a-z-]*$/.test(role)) return false

  return words.slice(0, -1).every((word) => {
    if (TITLE_CONNECTORS.has(word.toLowerCase())) return true
    return /^[A-Z][A-Za-z]*(?:-[a-z]+)*$/.test(word)
  })
}

function isDocsMetadataSegment(segment: Segment): boolean {
  const lines = segment.targetLines
    ?.map((line) => line.lineText.trim())
    .filter((line) => line !== '') ?? []
  if (lines.length === 0) return false
  if (lines.some(isMetadataLabel)) return true
  const identityDetails = lines.slice(1)
  if (
    lines.length >= 2 &&
    isTitleCaseLine(lines[0] ?? '') &&
    identityDetails.some(isSentenceCaseRoleLine) &&
    identityDetails.every(
      (line) => isTitleCaseLine(line) || isSentenceCaseRoleLine(line)
    )
  ) {
    return true
  }
  return (
    titleWords(lines.join(' ')).length >= 2 &&
    lines.every(isTitleCaseLine)
  )
}

function isTimedTranslatedSegment(
  segment: Segment
): segment is TimedTranslatedSegment {
  return (
    typeof segment.startFrames === 'number' &&
    typeof segment.endFrames === 'number' &&
    segment.translation.trim() !== '' &&
    !isDocsMetadataSegment(segment)
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
