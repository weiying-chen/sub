import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

const TSV_RE =
  /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

function findNextNonEmptyLineIndex(
  doc: EditorView['state']['doc'],
  fromIndexExclusive: number
): number | null {
  for (let i = fromIndexExclusive + 1; i < doc.lines; i++) {
    const line = doc.line(i + 1).text
    if (line.trim() !== '') return i
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
    span.textContent =
      this.part === 'start' ? '┌' : this.part === 'end' ? '└' : '│'
    return span
  }
}

export function timestampLinkGutter(findings: Finding[]) {
  const cpsBad = new Set<number>()
  for (const f of findings) {
    if (f.type === 'CPS') cpsBad.add(f.lineIndex) // timestamp line index
  }

  const markers = (view: EditorView) => {
    const b = new RangeSetBuilder<GutterMarker>()
    const doc = view.state.doc

    for (let tsIndex = 0; tsIndex < doc.lines; tsIndex++) {
      const tsText = doc.line(tsIndex + 1).text
      if (!TSV_RE.test(tsText)) continue

      const englishIndex = findNextNonEmptyLineIndex(doc, tsIndex)
      if (englishIndex == null) continue

      const englishText = doc.line(englishIndex + 1).text
      if (englishText.trim() === '') continue

      const isBad = cpsBad.has(tsIndex)

      for (let i = tsIndex; i <= englishIndex; i++) {
        const part: LinkPart =
          i === tsIndex ? 'start' : i === englishIndex ? 'end' : 'mid'

        const line = doc.line(i + 1)
        b.add(line.from, line.from, new LinkMarker(part, isBad))
      }
    }

    return b.finish()
  }

  return gutter({
    class: 'cm-ts-link-gutter',
    markers,
  })
}
