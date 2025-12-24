import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

import { TSV_RE } from '../shared/subtitles'
import { type LineSource, parseBlockAt, mergeForward } from '../shared/tsvRuns'

type LinkState = 'ok' | 'flagged'
type LinkPart = 'start' | 'mid' | 'end'

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

export function timestampLinkGutter(findings: Finding[]) {
  const flaggedRuns = new Set<number>()

  for (const f of findings) {
    if (f.type === 'CPS') flaggedRuns.add(f.lineIndex)
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

      const runState: LinkState = flaggedRuns.has(run.startTsIndex)
        ? 'flagged'
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
