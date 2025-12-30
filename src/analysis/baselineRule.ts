import type { Rule, BaselineMetric } from './types'

import { TSV_RE, extractInlineSubtitleText } from '../shared/subtitles'

type TsEntry = {
  lineIndex: number
  start: string
  end: string
  inlineText: string
}

function parseTimestampLines(lines: string[]): TsEntry[] {
  const out: TsEntry[] = []

  lines.forEach((line, lineIndex) => {
    const m = line.match(TSV_RE)
    if (!m?.groups) return

    const start = m.groups.start
    const end = m.groups.end
    const inlineText = extractInlineSubtitleText(line) ?? ''

    out.push({ lineIndex, start, end, inlineText })
  })

  return out
}

export function baselineRule(baselineText: string): Rule {
  const baselineLines = baselineText.split('\n')
  const baselineEntries = parseTimestampLines(baselineLines)

  return (ctx) => {
    if (ctx.lineIndex !== 0) return []

    const currentEntries = parseTimestampLines(ctx.lines)
    const metrics: BaselineMetric[] = []
    const maxLen = Math.max(baselineEntries.length, currentEntries.length)

    for (let i = 0; i < maxLen; i += 1) {
      const expected = baselineEntries[i]
      const actual = currentEntries[i]

      if (!expected && actual) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: actual.lineIndex,
          message: 'Extra timestamp line vs baseline',
          actual: `${actual.start} -> ${actual.end}`,
        })
        continue
      }

      if (expected && !actual) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: Math.min(expected.lineIndex, ctx.lines.length - 1),
          message: 'Missing timestamp line vs baseline',
          expected: `${expected.start} -> ${expected.end}`,
        })
        continue
      }

      if (!expected || !actual) continue

      if (expected.start !== actual.start || expected.end !== actual.end) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: actual.lineIndex,
          message: 'Timestamp mismatch vs baseline',
          expected: `${expected.start} -> ${expected.end}`,
          actual: `${actual.start} -> ${actual.end}`,
        })
      }

      if (expected.inlineText && expected.inlineText !== actual.inlineText) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: actual.lineIndex,
          message: 'Inline source text mismatch vs baseline',
          expected: expected.inlineText,
          actual: actual.inlineText || '(empty)',
        })
      }
    }

    return metrics
  }
}
