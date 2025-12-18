import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

const FPS = 30

// Rule: CPS is OK when cps <= 17. Flagged only when cps > 17.
const CPS_MAX = 17

type LinkState = 'ok' | 'flagged'

const TIME_RE = /^(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2}):(?<f>\d{2})$/

// Timestamp line: start<TAB>end<TAB>anything
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

  // With your current types, CPS findings always have a numeric cps.
  // Still defensive for future changes.
  const anyF = f as unknown as Record<string, unknown>
  const cps = anyF.cps
  if (typeof cps === 'number' && Number.isFinite(cps)) {
    return cps > CPS_MAX
  }

  // If something claims it's CPS but we can't read cps, treat as flagged
  // so it isn't silently ignored.
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
  // CPS findings are anchored to the FIRST timestamp line of a merged run.
  // Store only flagged; absence means ok.
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

      // If there's no payload below, we do not start anything and we do not show a broken marker.
      if (first.payloadIndex == null) continue

      const runStart = first.tsIndex
      let runEndDraw = first.payloadIndex // end marker should land on payload
      const runText = first.payloadText

      let scanTs = first.tsIndex
      let scanEndFrames = first.endFrames

      while (true) {
        const nextTs = findNextTimestampIndex(doc, scanTs)
        if (nextTs == null) break

        const next = parseBlockImmediate(doc, nextTs)
        if (!next) break

        // For a continuation merge:
        // - next timestamp must start exactly where previous ended
        // - payload text (below) must match the first payload text
        // - next must also have payload (otherwise don't extend the run)
        const isMerged =
          next.payloadIndex != null &&
          next.startFrames === scanEndFrames &&
          next.payloadText === runText

        if (!isMerged) break

        // isMerged already implies payloadIndex != null, keep explicit for clarity
        if (next.payloadIndex == null) break

        seenTs.add(next.tsIndex)

        runEndDraw = next.payloadIndex
        scanTs = next.tsIndex
        scanEndFrames = next.endFrames
      }

      const runState: LinkState = flaggedRuns.has(runStart) ? 'flagged' : 'ok'

      // Always draw a continuous column from the TS line down to the payload line,
      // even for a single block (so blank lines don't "break" the connector).
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
