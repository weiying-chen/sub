import { TIME_RE } from './subtitles'

export type FillSubsOptions = {
  maxChars?: number
}

export type FillSubsResult = {
  lines: string[]
  remaining: string
}

const DEFAULT_MAX_CHARS = 55

const SUBORD_RE = /\b(that)\b/i
const CONJ_RE = /\b(and|but|so|because)\b/i
const SENT_END = new Set(['.', '?', '!'])
const CLAUSE_PUNCT = new Set([',', ';', ':', '\u2014'])

function normalizeParagraph(text: string): string {
  return text.replace(/\r?\n+/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function parseColumns(line: string): string[] {
  return line.split('\t')
}

function isTimestampRow(line: string): boolean {
  const cols = parseColumns(line)
  return (
    cols.length >= 3 &&
    TIME_RE.test(cols[0] ?? '') &&
    TIME_RE.test(cols[1] ?? '')
  )
}

function findNextNonEmptyLine(lines: string[], startIndex: number): string | null {
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') return lines[i]
  }
  return null
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch)
}

function findRightmostSentenceEnd(window: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    const ch = window[i]
    if (!SENT_END.has(ch)) continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = window.slice(cut).trimStart()
    if (left && right) return cut
  }
  return -1
}

function findRightmostClausePunct(window: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    const ch = window[i]

    if (ch === '-' && window[i - 1] === '-') {
      const cut = i + 1
      const left = window.slice(0, cut).trimEnd()
      const right = window.slice(cut).trimStart()
      if (left && right) return cut
      i--
      continue
    }

    if (!CLAUSE_PUNCT.has(ch)) continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = window.slice(cut).trimStart()
    if (left && right) return cut
  }
  return -1
}

function findRightmostConjunctionStart(window: string): number {
  let best = -1
  const re = new RegExp(CONJ_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length

    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    const right = window.slice(start).trimStart()
    if (left && right) best = start
  }
  return best
}

function findRightmostSubordinatorStart(window: string): number {
  let best = -1
  const re = new RegExp(SUBORD_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length

    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    const right = window.slice(start).trimStart()
    if (left && right) best = start
  }
  return best
}

function findRightmostSpace(window: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] !== ' ') continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = window.slice(cut).trimStart()
    if (left && right) return cut
  }
  return -1
}

function findBestCut(window: string): number {
  const sentenceCut = findRightmostSentenceEnd(window)
  if (sentenceCut >= 0) return sentenceCut

  const clauseCut = findRightmostClausePunct(window)
  if (clauseCut >= 0) return clauseCut

  const subordCut = findRightmostSubordinatorStart(window)
  if (subordCut >= 0) return subordCut

  const conjCut = findRightmostConjunctionStart(window)
  if (conjCut >= 0) return conjCut

  const spaceCut = findRightmostSpace(window)
  if (spaceCut >= 0) return spaceCut

  return window.length
}

function takeLine(text: string, limit: number): { line: string; rest: string } {
  const s = text.trimStart()
  if (!s) return { line: '', rest: '' }

  if (s.length <= limit) {
    return { line: s.trimEnd(), rest: '' }
  }

  const window = s.slice(0, limit)
  const cut = findBestCut(window)

  const line = window.slice(0, cut).trimEnd()
  const rest = (window.slice(cut) + s.slice(limit)).trimStart()

  if (!line) {
    const hard = s.slice(0, limit)
    return { line: hard.trimEnd(), rest: s.slice(limit).trimStart() }
  }

  return { line, rest }
}

export function fillSelectedTimestampLines(
  lines: string[],
  selectedLineIndices: Set<number>,
  paragraph: string,
  options: FillSubsOptions = {}
): FillSubsResult {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS)
  const limit = Math.max(1, maxChars - 1)

  let remaining = normalizeParagraph(paragraph)
  if (!remaining) {
    return { lines: [...lines], remaining: '' }
  }

  const outLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    outLines.push(line)

    if (!selectedLineIndices.has(i)) continue
    if (!isTimestampRow(line)) continue

    const nextLine = findNextNonEmptyLine(lines, i)
    if (nextLine != null && !isTimestampRow(nextLine)) continue

    if (!remaining) continue

    const { line: fillLine, rest } = takeLine(remaining, limit)
    remaining = rest

    if (fillLine) outLines.push(fillLine)
  }

  return { lines: outLines, remaining }
}
