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

function findNextTimestampIndex(lines: string[], index: number): number | null {
  for (let i = index + 1; i < lines.length; i += 1) {
    if (TSV_RE.test(lines[i] ?? '')) return i
  }
  return null
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

export function blockStructureRule(
  options: BlockStructureRuleOptions = {}
): SegmentRule {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false

  return ((ctx: SegmentCtx) => {
    if (!ctx.lines || ctx.segmentIndex !== 0) return []

    const lines = ctx.lines
    const metrics: BlockStructureMetric[] = []

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      const trimmed = line.trim()
      if (trimmed === '') continue

      if (!TSV_RE.test(line)) continue

      const nextTsIndex = findNextTimestampIndex(lines, i)
      const payloadIndex = findPayloadIndex(lines, i, ignoreEmptyLines)
      if (payloadIndex == null) continue

      if (nextTsIndex == null) continue
      const nextPayloadIndex = findPayloadIndex(lines, nextTsIndex, ignoreEmptyLines)
      const nextPayloadText =
        nextPayloadIndex != null ? (lines[nextPayloadIndex] ?? '').trim() : ''

      let scanIndex = payloadIndex + 1
      while (scanIndex < lines.length && scanIndex !== nextTsIndex) {
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
