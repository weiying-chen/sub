import { Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'
import type { Finding } from '../analysis/types'
import { mergeForward, parseBlockAt, type LineSource } from '../shared/tsvRuns'

type FindingEntry = { finding: Finding; index: number }
type Severity = 'error' | 'warn'
type PendingDecoration = {
  from: number
  to: number
  className: string
  severity: Severity
}

export function sortFindingsForDecorations(findings: Finding[]): FindingEntry[] {
  const severityRank = (f: Finding) =>
    'severity' in f && f.severity === 'error' ? 1 : 0

  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      if (a.finding.lineIndex !== b.finding.lineIndex) {
        return a.finding.lineIndex - b.finding.lineIndex
      }

      const severityDiff = severityRank(a.finding) - severityRank(b.finding)
      if (severityDiff !== 0) return severityDiff

      const isCpsFinding = (f: Finding) =>
        f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS'

      // Same line: MAX_CHARS first, CPS last
      if (a.finding.type === 'MAX_CHARS' && isCpsFinding(b.finding)) return -1
      if (isCpsFinding(a.finding) && b.finding.type === 'MAX_CHARS') return 1

      return 0
    })
}

export function subtractOverlapsBySeverity(
  ranges: PendingDecoration[]
): PendingDecoration[] {
  const errors = ranges
    .filter((range) => range.severity === 'error')
    .slice()
    .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))

  const out: PendingDecoration[] = []

  for (const range of ranges) {
    if (range.severity === 'error') {
      out.push(range)
      continue
    }

    let segments: Array<{ from: number; to: number }> = [{ from: range.from, to: range.to }]
    for (const err of errors) {
      if (err.to <= range.from) continue
      if (err.from >= range.to) break

      const next: Array<{ from: number; to: number }> = []
      for (const seg of segments) {
        if (err.to <= seg.from || err.from >= seg.to) {
          next.push(seg)
          continue
        }
        if (seg.from < err.from) next.push({ from: seg.from, to: err.from })
        if (err.to < seg.to) next.push({ from: err.to, to: seg.to })
      }
      segments = next
      if (segments.length === 0) break
    }

    for (const seg of segments) {
      if (seg.from < seg.to) {
        out.push({
          from: seg.from,
          to: seg.to,
          className: range.className,
          severity: range.severity,
        })
      }
    }
  }

  return out.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))
}

export function findingsDecorations(findings: Finding[], activeFindingId: string | null) {
  return defineDecorationsPlugin((view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()
    const doc = view.state.doc
    const src: LineSource = {
      lineCount: doc.lines,
      getLine: (i) => doc.line(i + 1).text,
    }

    const sorted = sortFindingsForDecorations(findings)

    const findingId = (finding: Finding, index: number) =>
      `${finding.type}-${finding.lineIndex}-${index}`

    const classFor = (finding: Finding, index: number) => {
      const severity =
        'severity' in finding && finding.severity ? finding.severity : 'warn'
      const severityClass = severity === 'error' ? 'cm-finding-error' : 'cm-finding-warn'
      const activeClass =
        activeFindingId && activeFindingId === findingId(finding, index)
          ? ' cm-finding-active'
          : ''
      return `${severityClass}${activeClass}`
    }

    const pending: PendingDecoration[] = []

    const underline = (
      from: number,
      to: number,
      className: string,
      severity: Severity
    ) => {
      if (from >= to) return
      pending.push({ from, to, className, severity })
    }

    const underlineWholeLine = (lineIndex: number, className: string, severity: Severity) => {
      if (lineIndex < 0 || lineIndex >= doc.lines) return
      const line = doc.line(lineIndex + 1)
      underline(line.from, line.to, className, severity)
    }

    const underlineCpsRunPayload = (
      tsIndex: number,
      className: string,
      severity: Severity
    ) => {
      if (tsIndex < 0 || tsIndex >= doc.lines) return false
      const first = parseBlockAt(src, tsIndex)
      if (!first) return false
      const run = mergeForward(src, first)
      for (let i = run.payloadIndexStart; i <= run.payloadIndexEnd; i += 1) {
        underlineWholeLine(i, className, severity)
      }
      return true
    }

    for (const { finding: f, index } of sorted) {
      const className = classFor(f, index)
      const severity: Severity =
        'severity' in f && f.severity === 'error' ? 'error' : 'warn'
      if (f.lineIndex < 0 || f.lineIndex >= doc.lines) continue

      if (f.type === 'MAX_CHARS') {
        const line = doc.line(f.lineIndex + 1)
        const from = Math.min(line.to, line.from + f.maxAllowed)
        underline(from, line.to, className, severity)
        continue
      }

      if (f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS_BALANCE') {
        const didUnderlineRun = underlineCpsRunPayload(f.lineIndex, className, severity)
        if (!didUnderlineRun) {
          underlineWholeLine(f.lineIndex, className, severity)
        }
        continue
      }

      if (
        f.type === 'NUMBER_STYLE' ||
        f.type === 'PERCENT_STYLE' ||
        f.type === 'CAPITALIZATION'
      ) {
        const line = doc.line(f.lineIndex + 1)
        const tokenLength = f.token.length
        const from = Math.min(line.to, line.from + f.index)
        const to = Math.min(line.to, from + Math.max(tokenLength, 1))
        underline(from, to, className, severity)
        continue
      }

      if (f.type === 'LEADING_WHITESPACE') {
        const line = doc.line(f.lineIndex + 1)
        const from = Math.min(line.to, line.from + f.index)
        const to = Math.min(line.to, from + Math.max(f.count, 1))
        underline(from, to, className, severity)
        continue
      }

      // Fallback for line-anchored findings without token offsets.
      underlineWholeLine(f.lineIndex, className, severity)
    }

    const merged = subtractOverlapsBySeverity(pending)
    for (const range of merged) {
      builder.add(range.from, range.to, Decoration.mark({ class: range.className }))
    }

    return builder.finish()
  })
}
