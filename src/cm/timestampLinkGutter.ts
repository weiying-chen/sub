import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

const FPS = 30

const TIME_RE = /^(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2}):(?<f>\d{2})$/
const TSV_RE =
  /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

function parseTimecodeToFrames(tc: string): number | null {
  const m = tc.trim().match(TIME_RE)
  if (!m?.groups) return null

  const h = Number(m.groups.h)
  const mn = Number(m.groups.m)
  const s = Number(m.groups.s)
  const f = Number(m.groups.f)

  if (
    !Number.isFinite(h) ||
    !Number.isFinite(mn) ||
    !Number.isFinite(s) ||
    !Number.isFinite(f)
  ) {
    return null
  }

  if (f < 0 || f >= FPS) return null

  return h * 108000 + mn * 1800 + s * 30 + f
}

type Block = {
  tsIndex: number
  textIndex: number
  text: string
  startFrames: number
  endFrames: number
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

  const textIndex = tsIndex + 1
  if (textIndex >= doc.lines) return null

  const text = doc.line(textIndex + 1).text
  if (text.trim() === '') return null

  return {
    tsIndex,
    textIndex,
    text,
    startFrames: start,
    endFrames: end,
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

type LinkPart = 'start' | 'mid' | 'end'

class LinkMarker extends GutterMarker {
  private part: LinkPart
  private isBad: boolean

  constructor(part: LinkPart, isBad: boolean) {
    super()
    this.part = part
    this.isBad = isBad
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-ts-link cm-ts-link--${this.part} ${
      this.isBad ? 'cm-ts-link--bad' : 'cm-ts-link--ok'
    }`

    // start: ┌  mid: │  end: └
    span.textContent =
      this.part === 'start' ? '┌' : this.part === 'end' ? '└' : '│'

    return span
  }
}

export function timestampLinkGutter(findings: Finding[]) {
  // CPS violations are anchored to the FIRST timestamp line of a merged run.
  const cpsBad = new Set<number>()
  for (const f of findings) {
    if (f.type === 'CPS') cpsBad.add(f.lineIndex)
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

      // Build a merged run by scanning forward across timestamp blocks.
      const runStart = first.tsIndex
      let runEndText = first.textIndex
      const runText = first.text

      let scanTs = first.tsIndex
      let scanEndFrames = first.endFrames

      while (true) {
        const nextTs = findNextTimestampIndex(doc, scanTs)
        if (nextTs == null) break

        const next = parseBlockImmediate(doc, nextTs)
        if (!next) break

        const isMerged =
          next.text === runText && next.startFrames === scanEndFrames

        if (!isMerged) break

        // Mark this timestamp as part of this run so we don't start a new run from it later.
        seenTs.add(next.tsIndex)

        // Extend run to include everything down to next text line.
        runEndText = next.textIndex
        scanTs = next.tsIndex
        scanEndFrames = next.endFrames
      }

      // If it did NOT merge with anything, keep the simple 2-line "staple".
      if (runEndText === first.textIndex) {
        const isBad = cpsBad.has(first.tsIndex)

        const tsLine = doc.line(first.tsIndex + 1)
        b.add(tsLine.from, tsLine.from, new LinkMarker('start', isBad))

        const enLine = doc.line(first.textIndex + 1)
        b.add(enLine.from, enLine.from, new LinkMarker('end', isBad))

        continue
      }

      // Merged run: draw a continuous column from the first timestamp to the last text.
      const runIsBad = cpsBad.has(runStart)

      for (let i = runStart; i <= runEndText; i++) {
        const part: LinkPart =
          i === runStart ? 'start' : i === runEndText ? 'end' : 'mid'

        const line = doc.line(i + 1)
        b.add(line.from, line.from, new LinkMarker(part, runIsBad))
      }
    }

    return b.finish()
  }

  return gutter({
    class: 'cm-ts-link-gutter',
    markers,
  })
}
