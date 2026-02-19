import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

import { TSV_RE } from '../shared/subtitles'
import { type LineSource, parseBlockAt, mergeForward } from '../shared/tsvRuns'

type LinkState = 'ok' | 'warn' | 'flagged'
type LinkPart = 'start' | 'mid' | 'end'
type TimestampLinkGutterOptions = {
  colorize?: boolean
}

function findingTsLineIndex(f: Finding): number {
  if (
    (f.type === 'MAX_CPS' || f.type === 'MIN_CPS' || f.type === 'CPS_BALANCE') &&
    typeof f.tsLineIndex === 'number'
  ) {
    return f.tsLineIndex
  }
  return f.lineIndex
}

class LinkMarker extends GutterMarker {
  private part: LinkPart
  private state: LinkState

  constructor(part: LinkPart, state: LinkState) {
    super()
    this.part = part
    this.state = state
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-ts-link cm-ts-link--${this.part} cm-ts-link--${this.state}`
    span.textContent =
      this.part === 'start' ? '┌' : this.part === 'end' ? '└' : '│'
    return span
  }
}

export function getTimestampRunState(
  findings: Finding[],
  tsIndex: number,
  colorize: boolean
): LinkState {
  if (!colorize) return 'ok'
  if (
    findings.some(
      (f) => (f.type === 'MAX_CPS' || f.type === 'CPS') && findingTsLineIndex(f) === tsIndex
    )
  ) {
    return 'flagged'
  }
  if (
    findings.some(
      (f) =>
        (f.type === 'MIN_CPS' || f.type === 'CPS_BALANCE') &&
        findingTsLineIndex(f) === tsIndex
    )
  ) {
    return 'warn'
  }
  return 'ok'
}

export function timestampLinkGutter(
  findings: Finding[],
  options: TimestampLinkGutterOptions = {}
) {
  const colorize = options.colorize ?? true
  const flaggedRuns = new Set<number>()
  const warnRuns = new Set<number>()

  for (const f of findings) {
    if (f.type === 'MAX_CPS' || f.type === 'CPS') {
      // red
      flaggedRuns.add(findingTsLineIndex(f))
      continue
    }

    if (f.type === 'MIN_CPS' || f.type === 'CPS_BALANCE') {
      // yellow
      warnRuns.add(findingTsLineIndex(f))
      continue
    }
  }

  const markers = (view: EditorView) => {
    const b = new RangeSetBuilder<GutterMarker>()
    const doc = view.state.doc

    const src: LineSource = {
      lineCount: doc.lines,
      getLine: (i) => doc.line(i + 1).text,
    }

    const seenTs = new Set<number>()

    for (let tsIndex = 0; tsIndex < doc.lines; tsIndex++) {
      if (seenTs.has(tsIndex)) continue

      const tsText = doc.line(tsIndex + 1).text
      if (!TSV_RE.test(tsText)) continue

      const first = parseBlockAt(src, tsIndex)
      if (!first) continue

      const run = mergeForward(src, first)

      // Mark all timestamp indices inside this run as seen
      for (let i = run.startTsIndex; i <= run.endTsIndex; i++) {
        seenTs.add(i)
      }

      // Precedence: flagged (red) > warn (yellow) > ok
      const runState: LinkState = colorize
        ? flaggedRuns.has(run.startTsIndex)
          ? 'flagged'
          : warnRuns.has(run.startTsIndex)
            ? 'warn'
            : 'ok'
        : 'ok'

      // Draw from first timestamp line down to the last payload line of the run
      for (let i = run.startTsIndex; i <= run.payloadIndexEnd; i++) {
        const part: LinkPart =
          i === run.startTsIndex
            ? 'start'
            : i === run.payloadIndexEnd
              ? 'end'
              : 'mid'

        const line = doc.line(i + 1)
        b.add(line.from, line.from, new LinkMarker(part, runState))
      }
    }

    return b.finish()
  }

  return gutter({
    class: 'cm-ts-link-gutter',
    markers,
  })
}
