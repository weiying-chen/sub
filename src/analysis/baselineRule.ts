import type { Rule, BaselineMetric, RuleCtx } from './types'

import { TSV_RE, extractSourceText } from '../shared/subtitles'
import { normalizeLineEndings } from '../shared/normalizeLineEndings'
import { isSubsCommentLine } from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

type TsEntry = {
  lineIndex: number
  start: string
  end: string
  sourceText: string
}

type BaselineRuleOptions = {
  includeFollowingHanLines?: boolean
}

function normalizeBaselineSourceText(text: string): string {
  return text.replace(/\*/g, '').trim()
}

function parseTimestampLines(
  lines: string[],
  includeFollowingHanLines = false
): TsEntry[] {
  const out: TsEntry[] = []

  lines.forEach((line, lineIndex) => {
    const normalizedLine = line.replace(/\*/g, '').trimEnd()
    const m = normalizedLine.match(TSV_RE)
    if (!m?.groups) return

    const start = m.groups.start
    const end = m.groups.end
    const sourceParts: string[] = []
    const inlineSourceText = normalizeBaselineSourceText(
      extractSourceText(normalizedLine) ?? ''
    )
    if (inlineSourceText) sourceParts.push(inlineSourceText)

    if (includeFollowingHanLines) {
      for (let nextIndex = lineIndex + 1; nextIndex < lines.length; nextIndex += 1) {
        if (isSubsCommentLine(lines[nextIndex] ?? '')) continue
        const nextLine = lines[nextIndex]?.replace(/\*/g, '').trimEnd() ?? ''
        if (TSV_RE.test(nextLine)) break
        const candidate = normalizeBaselineSourceText(nextLine)
        if (candidate && /\p{Script=Han}/u.test(candidate)) {
          sourceParts.push(candidate)
        }
      }
    }

    out.push({ lineIndex, start, end, sourceText: sourceParts.join(' ') })
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

export function baselineRule(
  baselineText: string,
  options: BaselineRuleOptions = {}
): BaselineRule {
  const baselineLines = normalizeLineEndings(baselineText).split('\n')
  const includeFollowingHanLines = options.includeFollowingHanLines ?? false
  const baselineEntries = parseTimestampLines(
    baselineLines,
    includeFollowingHanLines
  )

  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      if (ctx.segmentIndex !== 0) return []
      if (!ctx.lines) return []

      const metrics: BaselineMetric[] = []
      const currentEntries = parseTimestampLines(
        ctx.lines,
        includeFollowingHanLines
      )
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
          ruleCode: 'MISSING_TIMESTAMP_LINE',
          lineIndex,
          reason: 'missing',
          timestamp: `${entry.start} -> ${entry.end}`,
          expected: `${entry.start} -> ${entry.end}`,
          baselineLineIndex: entry.lineIndex,
        })
      }

      for (const entry of extra) {
        metrics.push({
          type: 'BASELINE',
          ruleCode: 'EXTRA_TIMESTAMP_LINE',
          lineIndex: entry.lineIndex,
          reason: 'extra',
          timestamp: `${entry.start} -> ${entry.end}`,
          actual: `${entry.start} -> ${entry.end}`,
        })
      }

      for (const { expected, actual } of matches) {
        if (expected.sourceText && expected.sourceText !== actual.sourceText) {
          metrics.push({
            type: 'BASELINE',
            ruleCode: 'SOURCE_TEXT_MISMATCH',
            lineIndex: actual.lineIndex,
            message: 'Original text mismatch between current file and baseline file.',
            reason: 'sourceText',
            timestamp: `${expected.start} -> ${expected.end}`,
            expected: expected.sourceText,
            actual: actual.sourceText || '(empty)',
          })
        }
      }

      return metrics
    }

    if (ctx.lineIndex !== 0) return []

    const metrics: BaselineMetric[] = []
    const currentEntries = parseTimestampLines(
      ctx.lines,
      includeFollowingHanLines
    )
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
        ruleCode: 'MISSING_TIMESTAMP_LINE',
        lineIndex,
        reason: 'missing',
        timestamp: `${entry.start} -> ${entry.end}`,
        expected: `${entry.start} -> ${entry.end}`,
        baselineLineIndex: entry.lineIndex,
      })
    }

    for (const entry of extra) {
      metrics.push({
        type: 'BASELINE',
        ruleCode: 'EXTRA_TIMESTAMP_LINE',
        lineIndex: entry.lineIndex,
        reason: 'extra',
        timestamp: `${entry.start} -> ${entry.end}`,
        actual: `${entry.start} -> ${entry.end}`,
      })
    }

    for (const { expected, actual } of matches) {
      if (expected.sourceText && expected.sourceText !== actual.sourceText) {
        metrics.push({
          type: 'BASELINE',
          ruleCode: 'SOURCE_TEXT_MISMATCH',
          lineIndex: actual.lineIndex,
          message: 'Original text mismatch between current file and baseline file.',
          reason: 'sourceText',
          timestamp: `${expected.start} -> ${expected.end}`,
          expected: expected.sourceText,
          actual: actual.sourceText || '(empty)',
        })
      }
    }

    return metrics
  }) as BaselineRule
}
