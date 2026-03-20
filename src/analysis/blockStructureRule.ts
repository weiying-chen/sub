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

function findPreviousTimestampIndex(lines: string[], index: number): number | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (TSV_RE.test(lines[i] ?? '')) return i
  }
  return null
}

function findNextTimestampIndex(lines: string[], index: number): number | null {
  for (let i = index + 1; i < lines.length; i += 1) {
    if (TSV_RE.test(lines[i] ?? '')) return i
  }
  return null
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

      if (TSV_RE.test(line)) {
        let nextIndex = i + 1
        if (ignoreEmptyLines) {
          while (nextIndex < lines.length && (lines[nextIndex] ?? '').trim() === '') {
            nextIndex += 1
          }
        }

        const nextLine = lines[nextIndex] ?? ''
        if (
          nextIndex >= lines.length ||
          nextLine.trim() === '' ||
          TSV_RE.test(nextLine)
        ) {
          metrics.push({
            type: 'BLOCK_STRUCTURE',
            lineIndex: i,
            ruleCode: 'MISSING_PAYLOAD',
            text: line,
          })
        }
        continue
      }

      if (!isEnglishLikeLine(line)) continue

      const prevNonEmptyIndex = findPreviousNonEmptyIndex(lines, i)
      if (prevNonEmptyIndex != null && TSV_RE.test(lines[prevNonEmptyIndex] ?? '')) {
        continue
      }

      const hasTimestampContext =
        findPreviousTimestampIndex(lines, i) != null ||
        findNextTimestampIndex(lines, i) != null
      if (!hasTimestampContext) continue

      metrics.push({
        type: 'BLOCK_STRUCTURE',
        lineIndex: i,
        ruleCode: 'ORPHAN_PAYLOAD',
        text: trimmed,
      })
    }

    return metrics
  }) as SegmentRule
}
