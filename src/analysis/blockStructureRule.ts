import type { BlockStructureMetric } from './types'
import type { SegmentCtx, SegmentRule } from './segments'

import { TSV_RE } from '../shared/subtitles'

type BlockStructureRuleOptions = {
  ignoreEmptyLines?: boolean
}

function findSectionEnd(lines: string[], startIndex: number): number {
  let endIndex = startIndex
  while (endIndex < lines.length && (lines[endIndex] ?? '').trim() !== '') {
    endIndex += 1
  }
  return endIndex
}

function collectTimestampIndices(
  lines: string[],
  startIndex: number,
  endIndex: number
): number[] {
  const indices: number[] = []
  for (let i = startIndex; i < endIndex; i += 1) {
    if (TSV_RE.test(lines[i] ?? '')) indices.push(i)
  }
  return indices
}

function findPayloadIndex(
  lines: string[],
  tsIndex: number,
  ignoreEmptyLines: boolean
): number | null {
  let payloadIndex = tsIndex + 1
  if (ignoreEmptyLines) {
    while (payloadIndex < lines.length && (lines[payloadIndex] ?? '').trim() === '') {
      payloadIndex += 1
    }
  }

  const payloadLine = lines[payloadIndex] ?? ''
  if (
    payloadIndex >= lines.length ||
    payloadLine.trim() === '' ||
    TSV_RE.test(payloadLine)
  ) {
    return null
  }

  return payloadIndex
}

function isWithinSection(
  index: number | null,
  startIndex: number,
  endIndex: number
): index is number {
  return index != null && index >= startIndex && index < endIndex
}

export function blockStructureRule(
  options: BlockStructureRuleOptions = {}
): SegmentRule {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false

  return ((ctx: SegmentCtx) => {
    if (!ctx.lines || ctx.segmentIndex !== 0) return []

    const lines = ctx.lines
    const metrics: BlockStructureMetric[] = []

    for (let sectionStart = 0; sectionStart < lines.length; ) {
      while (sectionStart < lines.length && (lines[sectionStart] ?? '').trim() === '') {
        sectionStart += 1
      }
      if (sectionStart >= lines.length) break

      const sectionEnd = findSectionEnd(lines, sectionStart)
      const timestampIndices = collectTimestampIndices(lines, sectionStart, sectionEnd)
      if (timestampIndices.length === 0) {
        sectionStart = sectionEnd + 1
        continue
      }

      const payloadByTimestamp = new Map<number, number | null>()
      let sectionHasAnyPayload = false
      for (const tsIndex of timestampIndices) {
        const payloadIndex = findPayloadIndex(lines, tsIndex, ignoreEmptyLines)
        const sectionPayloadIndex = isWithinSection(payloadIndex, sectionStart, sectionEnd)
          ? payloadIndex
          : null
        payloadByTimestamp.set(tsIndex, sectionPayloadIndex)
        if (sectionPayloadIndex != null) sectionHasAnyPayload = true
      }

      if (sectionHasAnyPayload) {
        for (const tsIndex of timestampIndices) {
          if (payloadByTimestamp.get(tsIndex) != null) continue
          metrics.push({
            type: 'BLOCK_STRUCTURE',
            lineIndex: tsIndex,
            ruleCode: 'MISSING_PAYLOAD',
            text: (lines[tsIndex] ?? '').trim(),
          })
        }
      }

      sectionStart = sectionEnd + 1
    }

    return metrics
  }) as SegmentRule
}
