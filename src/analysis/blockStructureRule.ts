import type { BlockStructureMetric } from './types'
import type { SegmentCtx, SegmentRule } from './segments'

import { TSV_RE } from '../shared/subtitles'

type BlockStructureRuleOptions = {
  ignoreEmptyLines?: boolean
}

function isEnglishLikeLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  if (trimmed.startsWith('(') || trimmed.startsWith('[')) return false
  if (trimmed.startsWith('/*')) return false

  const cjkRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
  if (cjkRe.test(text)) return false

  const letters = text.match(/[A-Za-z]/g)
  return (letters?.length ?? 0) >= 3
}

function findPreviousNonEmptyIndex(lines: string[], index: number): number | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (lines[i]?.trim() !== '') return i
  }
  return null
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

    const timestampIndices = collectTimestampIndices(lines, 0, lines.length)
    for (let j = 0; j < timestampIndices.length - 1; j += 1) {
      const tsIndex = timestampIndices[j]
      const nextTsIndex = timestampIndices[j + 1]
      const payloadIndex = findPayloadIndex(lines, tsIndex, ignoreEmptyLines)
      if (payloadIndex == null) continue

      const nextPayloadIndex = findPayloadIndex(lines, nextTsIndex, ignoreEmptyLines)
      const nextPayloadText =
        nextPayloadIndex != null ? (lines[nextPayloadIndex] ?? '').trim() : ''

      let scanIndex = payloadIndex + 1
      while (scanIndex < nextTsIndex) {
        const scanLine = lines[scanIndex] ?? ''
        const scanTrimmed = scanLine.trim()
        if (scanTrimmed === '') {
          scanIndex += 1
          continue
        }
        if (!TSV_RE.test(scanLine) && isEnglishLikeLine(scanLine)) {
          const prevNonEmptyIndex = findPreviousNonEmptyIndex(lines, scanIndex)
          if (
            prevNonEmptyIndex != null &&
            !TSV_RE.test(lines[prevNonEmptyIndex] ?? '') &&
            nextPayloadText !== '' &&
            scanTrimmed === nextPayloadText
          ) {
            metrics.push({
              type: 'BLOCK_STRUCTURE',
              lineIndex: scanIndex,
              ruleCode: 'ORPHAN_PAYLOAD',
              text: scanTrimmed,
            })
          }
        }
        scanIndex += 1
      }
    }

    return metrics
  }) as SegmentRule
}
