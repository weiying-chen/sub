import type { Rule, BaselineMetric, RuleCtx } from './types'

import { TSV_RE, extractInlineSubtitleText } from '../shared/subtitles'
import type { SegmentCtx, SegmentRule } from './segments'

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

type MatchPair = { expected: TsEntry; actual: TsEntry }
type MatchIndex = { expectedIndex: number; actualLineIndex: number }

function entryKey(entry: TsEntry): string {
  return `${entry.start}\t${entry.end}`
}

function lcsMatchPairs(
  expected: TsEntry[],
  actual: TsEntry[]
): MatchPair[] {
  const m = expected.length
  const n = actual.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (entryKey(expected[i - 1]) === entryKey(actual[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const pairs: MatchPair[] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (entryKey(expected[i - 1]) === entryKey(actual[j - 1])) {
      pairs.push({ expected: expected[i - 1], actual: actual[j - 1] })
      i -= 1
      j -= 1
      continue
    }

    if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1
    } else {
      j -= 1
    }
  }

  return pairs.reverse()
}

function diffTimestampEntries(
  expected: TsEntry[],
  actual: TsEntry[]
): { matches: MatchPair[]; missing: TsEntry[]; extra: TsEntry[] } {
  const matches = lcsMatchPairs(expected, actual)
  const matchedExpected = new Set(matches.map((m) => m.expected))
  const matchedActual = new Set(matches.map((m) => m.actual))

  return {
    matches,
    missing: expected.filter((entry) => !matchedExpected.has(entry)),
    extra: actual.filter((entry) => !matchedActual.has(entry)),
  }
}

function buildMatchIndex(
  expected: TsEntry[],
  matches: MatchPair[]
): MatchIndex[] {
  const expectedIndex = new Map<TsEntry, number>()
  expected.forEach((entry, index) => expectedIndex.set(entry, index))

  const indexed: MatchIndex[] = []
  for (const match of matches) {
    const index = expectedIndex.get(match.expected)
    if (index == null) continue
    indexed.push({
      expectedIndex: index,
      actualLineIndex: match.actual.lineIndex,
    })
  }

  indexed.sort((a, b) => a.expectedIndex - b.expectedIndex)
  return indexed
}

function findMissingAnchor(
  expectedIndex: number,
  matchIndex: MatchIndex[],
  fallbackLineIndex: number,
  preferredLineIndex: number,
  currentLineCount: number
): number {
  if (preferredLineIndex >= 0 && preferredLineIndex < currentLineCount) {
    return preferredLineIndex
  }

  if (matchIndex.length === 0) return fallbackLineIndex

  let before: MatchIndex | null = null
  for (const match of matchIndex) {
    if (match.expectedIndex > expectedIndex) {
      return match.actualLineIndex
    }
    before = match
  }

  return before ? before.actualLineIndex : fallbackLineIndex
}

type BaselineRule = Rule & SegmentRule

export function baselineRule(baselineText: string): BaselineRule {
  const baselineLines = baselineText.split('\n')
  const baselineEntries = parseTimestampLines(baselineLines)

  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      if (ctx.segmentIndex !== 0) return []
      if (!ctx.lines) return []

      const metrics: BaselineMetric[] = []
      const currentEntries = parseTimestampLines(ctx.lines)
      const { matches, missing, extra } = diffTimestampEntries(
        baselineEntries,
        currentEntries
      )
      const matchIndex = buildMatchIndex(baselineEntries, matches)

      for (const entry of missing) {
        const expectedIndex = baselineEntries.indexOf(entry)
        const lineIndex = findMissingAnchor(
          expectedIndex,
          matchIndex,
          Math.max(0, ctx.lines.length - 1),
          entry.lineIndex,
          ctx.lines.length
        )
        metrics.push({
          type: 'BASELINE',
          lineIndex,
          message: 'Missing timestamp line vs baseline',
          reason: 'missing',
          timestamp: `${entry.start} -> ${entry.end}`,
          expected: `${entry.start} -> ${entry.end}`,
          baselineLineIndex: entry.lineIndex,
        })
      }

      for (const entry of extra) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: entry.lineIndex,
          message: 'Extra timestamp line vs baseline',
          reason: 'extra',
          timestamp: `${entry.start} -> ${entry.end}`,
          actual: `${entry.start} -> ${entry.end}`,
        })
      }

      for (const { expected, actual } of matches) {
        if (expected.inlineText && expected.inlineText !== actual.inlineText) {
          metrics.push({
            type: 'BASELINE',
            lineIndex: actual.lineIndex,
            message: 'Inline source text mismatch vs baseline',
            reason: 'inlineText',
            timestamp: `${expected.start} -> ${expected.end}`,
            expected: expected.inlineText,
            actual: actual.inlineText || '(empty)',
          })
        }
      }

      return metrics
    }

    if (ctx.lineIndex !== 0) return []

    const metrics: BaselineMetric[] = []
    const currentEntries = parseTimestampLines(ctx.lines)
    const { matches, missing, extra } = diffTimestampEntries(
      baselineEntries,
      currentEntries
    )
    const matchIndex = buildMatchIndex(baselineEntries, matches)

    for (const entry of missing) {
      const expectedIndex = baselineEntries.indexOf(entry)
      const lineIndex = findMissingAnchor(
        expectedIndex,
        matchIndex,
        Math.max(0, ctx.lines.length - 1),
        entry.lineIndex,
        ctx.lines.length
      )
      metrics.push({
        type: 'BASELINE',
        lineIndex,
        message: 'Missing timestamp line vs baseline',
        reason: 'missing',
        timestamp: `${entry.start} -> ${entry.end}`,
        expected: `${entry.start} -> ${entry.end}`,
        baselineLineIndex: entry.lineIndex,
      })
    }

    for (const entry of extra) {
      metrics.push({
        type: 'BASELINE',
        lineIndex: entry.lineIndex,
        message: 'Extra timestamp line vs baseline',
        reason: 'extra',
        timestamp: `${entry.start} -> ${entry.end}`,
        actual: `${entry.start} -> ${entry.end}`,
      })
    }

    for (const { expected, actual } of matches) {
      if (expected.inlineText && expected.inlineText !== actual.inlineText) {
        metrics.push({
          type: 'BASELINE',
          lineIndex: actual.lineIndex,
          message: 'Inline source text mismatch vs baseline',
          reason: 'inlineText',
          timestamp: `${expected.start} -> ${expected.end}`,
          expected: expected.inlineText,
          actual: actual.inlineText || '(empty)',
        })
      }
    }

    return metrics
  }) as BaselineRule
}
