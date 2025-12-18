import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

import { MAX_CPS, TSV_RE, parseTimecodeToFrames } from '../shared/subtitles'

type LinkState = 'ok' | 'flagged'

type PayloadInfo = {
  payloadIndex: number | null
  payloadText: string
}

function findPayloadBelow(
  doc: EditorView['state']['doc'],
  tsIndex: number
): PayloadInfo {
  for (let i = tsIndex + 1; i < doc.lines; i++) {
    const t = doc.line(i + 1).text
    if (TSV_RE.test(t)) break
    if (t.trim() !== '') return { payloadIndex: i, payloadText: t }
  }
  return { payloadIndex: null, payloadText: '' }
}

type Block = {
  tsIndex: number
  startFrames: number
  endFrames: number
  payloadIndex: number | null
  payloadText: string
}

function parseBlockImmediate(
  doc: EditorView['state']['doc'],
  tsIndex: number
): Block | null {
  const tsLine = doc.line(tsIndex + 1).text
  const m = tsLine.match(TSV_RE)
  if (!m?.groups) return null

  const start = parseTimecodeToFrames(m.groups.start)
  const end = parseTimecodeToFrames(m.groups.end)
  if (start == null || end == null || end < start) return null

  const { payloadIndex, payloadText } = findPayloadBelow(doc, tsIndex)

  return {
    tsIndex,
    startFrames: start,
    endFrames: end,
    payloadIndex,
    payloadText,
  }
}

function findNextTimestampIndex(
  doc: EditorView['state']['doc'],
  fromIndexExclusive: number
): number | null {
  for (let i = fromIndexExclusive + 1; i < doc.lines; i++) {
    const t = doc.line(i + 1).text
    if (TSV_RE.test(t)) return i
  }
  return null
}

function isCpsFindingFlagged(f: Finding): boolean {
  if (f.type !== 'CPS') return false

  const anyF = f as unknown as Record<string, unknown>
  const cps = anyF.cps
  if (typeof cps === 'number' && Number.isFinite(cps)) {
    return cps > MAX_CPS
  }

  return true
}

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
    if (isCpsFindingFlagged(f)) flaggedRuns.add(f.lineIndex)
  }

  const markers = (view: EditorView) => {
    const b = new RangeSetBuilder<GutterMarker>()
    const doc = view.state.doc

    const seenTs = new Set<number>()

    for (let tsIndex = 0; tsIndex < doc.lines; tsIndex++) {
      if (seenTs.has(tsIndex)) continue

      const tsText = doc.line(tsIndex + 1).text
      if (!TSV_RE.test(tsText)) continue

      const first = parseBlockImmediate(doc, tsIndex)
      if (!first) continue

      if (first.payloadIndex == null) continue

      const runStart = first.tsIndex
      let runEndDraw = first.payloadIndex
      const runText = first.payloadText

      let scanTs = first.tsIndex
      let scanEndFrames = first.endFrames

      while (true) {
        const nextTs = findNextTimestampIndex(doc, scanTs)
        if (nextTs == null) break

        const next = parseBlockImmediate(doc, nextTs)
        if (!next) break

        const isMerged =
          next.payloadIndex != null &&
          next.startFrames === scanEndFrames &&
          next.payloadText === runText

        if (!isMerged) break
        if (next.payloadIndex == null) break

        seenTs.add(next.tsIndex)

        runEndDraw = next.payloadIndex
        scanTs = next.tsIndex
        scanEndFrames = next.endFrames
      }

      const runState: LinkState = flaggedRuns.has(runStart) ? 'flagged' : 'ok'

      for (let i = runStart; i <= runEndDraw; i++) {
        const part: LinkPart =
          i === runStart ? 'start' : i === runEndDraw ? 'end' : 'mid'

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
