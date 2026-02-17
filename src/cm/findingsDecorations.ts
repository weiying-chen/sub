import { Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { defineDecorationsPlugin } from './defineDecorationsPlugin'
import type { Finding } from '../analysis/types'
import { mergeForward, parseBlockAt, type LineSource } from '../shared/tsvRuns'

export function findingsDecorations(findings: Finding[]) {
  return defineDecorationsPlugin((view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()
    const doc = view.state.doc
    const src: LineSource = {
      lineCount: doc.lines,
      getLine: (i) => doc.line(i + 1).text,
    }

    // Still keep deterministic order (useful if you add more decorations later)
    const sorted = [...findings].sort((a, b) => {
      if (a.lineIndex !== b.lineIndex) {
        return a.lineIndex - b.lineIndex
      }

      const isCpsFinding = (f: Finding) =>
        f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS'

      // Same line: MAX_CHARS first, CPS last
      if (a.type === 'MAX_CHARS' && isCpsFinding(b)) return -1
      if (isCpsFinding(a) && b.type === 'MAX_CHARS') return 1

      return 0
    })

    const classFor = (finding: Finding) => {
      const severity =
        'severity' in finding && finding.severity ? finding.severity : 'warn'
      return severity === 'error' ? 'cm-finding-error' : 'cm-finding-warn'
    }

    const underline = (from: number, to: number, className: string) => {
      if (from >= to) return
      builder.add(from, to, Decoration.mark({ class: className }))
    }

    const underlineWholeLine = (lineIndex: number, className: string) => {
      if (lineIndex < 0 || lineIndex >= doc.lines) return
      const line = doc.line(lineIndex + 1)
      underline(line.from, line.to, className)
    }

    const underlineCpsRunPayload = (tsIndex: number, className: string) => {
      if (tsIndex < 0 || tsIndex >= doc.lines) return false
      const first = parseBlockAt(src, tsIndex)
      if (!first) return false
      const run = mergeForward(src, first)
      for (let i = run.payloadIndexStart; i <= run.payloadIndexEnd; i += 1) {
        underlineWholeLine(i, className)
      }
      return true
    }

    for (const f of sorted) {
      const className = classFor(f)
      if (f.lineIndex < 0 || f.lineIndex >= doc.lines) continue

      if (f.type === 'MAX_CHARS') {
        const line = doc.line(f.lineIndex + 1)
        const from = Math.min(line.to, line.from + f.maxAllowed)
        underline(from, line.to, className)
        continue
      }

      if (f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS_BALANCE') {
        const didUnderlineRun = underlineCpsRunPayload(f.lineIndex, className)
        if (!didUnderlineRun) {
          underlineWholeLine(f.lineIndex, className)
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
        underline(from, to, className)
        continue
      }

      if (f.type === 'LEADING_WHITESPACE') {
        const line = doc.line(f.lineIndex + 1)
        const from = Math.min(line.to, line.from + f.index)
        const to = Math.min(line.to, from + Math.max(f.count, 1))
        underline(from, to, className)
        continue
      }

      // Fallback for line-anchored findings without token offsets.
      underlineWholeLine(f.lineIndex, className)
    }

    return builder.finish()
  })
}
