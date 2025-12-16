import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { Finding } from '../analysis/types'

const TSV_RE =
  /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

type LinkPart = 'start' | 'end'

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
    span.textContent = this.part === 'start' ? '┌' : '└'
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

      // Only link to the *immediate* next line.
      const englishIndex = tsIndex + 1
      if (englishIndex >= doc.lines) continue

      const englishText = doc.line(englishIndex + 1).text
      if (englishText.trim() === '') continue

      const isBad = cpsBad.has(tsIndex)

      // Add the two markers only (no spanning over blank lines).
      const tsLine = doc.line(tsIndex + 1)
      b.add(tsLine.from, tsLine.from, new LinkMarker('start', isBad))

      const enLine = doc.line(englishIndex + 1)
      b.add(enLine.from, enLine.from, new LinkMarker('end', isBad))
    }

    return b.finish()
  }

  return gutter({
    class: 'cm-ts-link-gutter',
    markers,
  })
}
