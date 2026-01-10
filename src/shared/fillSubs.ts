import { FPS, MAX_CPS, TIME_RE, parseTimecodeToFrames } from './subtitles'

export type FillSubsOptions = {
  maxChars?: number
  inline?: boolean
}

export type FillSubsResult = {
  lines: string[]
  remaining: string
}

const DEFAULT_MAX_CHARS = 54

const CONJ_RE = /\b(and|but|or|so|yet|for|nor)\b/i
const THAT_RE = /\b(that)\b/i
const STRONG_PUNCT = new Set(['.', '?', '!', ':', '\u2014'])
const SEMICOLON_PUNCT = new Set([';'])
const COMMA_PUNCT = new Set([','])
const QUOTE_CHARS = new Set(['"'])

export function normalizeParagraph(text: string): string {
  return text
    .replace(/\u2014/g, '---')
    .replace(/\r?\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function parseColumns(line: string): string[] {
  return line.split('\t')
}

function getTimestampDurationFrames(line: string): number | null {
  const cols = parseColumns(line)
  const startFrames = parseTimecodeToFrames(cols[0] ?? '')
  const endFrames = parseTimecodeToFrames(cols[1] ?? '')
  if (startFrames == null || endFrames == null) return null
  if (endFrames < startFrames) return null
  return endFrames - startFrames
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

function isQuoteChar(ch: string): boolean {
  return QUOTE_CHARS.has(ch)
}

function isPunctForQuote(ch: string): boolean {
  return (
    STRONG_PUNCT.has(ch) ||
    SEMICOLON_PUNCT.has(ch) ||
    COMMA_PUNCT.has(ch) ||
    ch === '-'
  )
}

function findRightmostStrongPunct(window: string): number {
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

    if (!STRONG_PUNCT.has(ch)) continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = window.slice(cut).trimStart()
    if (left && right) return cut
  }
  return -1
}

function findRightmostPunct(
  window: string,
  punctSet: Set<string>
): number {
  for (let i = window.length - 1; i >= 0; i--) {
    const ch = window[i]
    if (!punctSet.has(ch)) continue

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

function findRightmostThatStart(window: string): number {
  let best = -1
  const re = new RegExp(THAT_RE.source, 'gi')
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

function adjustCutForTrailingQuote(window: string, cut: number): number {
  if (cut <= 0) return cut
  if (!isPunctForQuote(window[cut - 1])) return cut

  let i = cut
  while (i < window.length && isQuoteChar(window[i])) i++
  return i
}

function findBestCut(window: string): number {
  const strongCut = findRightmostStrongPunct(window)
  if (strongCut >= 0) return strongCut

  const semicolonCut = findRightmostPunct(window, SEMICOLON_PUNCT)
  if (semicolonCut >= 0) return semicolonCut

  const commaCut = findRightmostPunct(window, COMMA_PUNCT)
  if (commaCut >= 0) return commaCut

  const conjCut = findRightmostConjunctionStart(window)
  if (conjCut >= 0) return conjCut

  const thatCut = findRightmostThatStart(window)
  if (thatCut >= 0) return thatCut

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
  const cut = adjustCutForTrailingQuote(window, findBestCut(window))

  const line = window.slice(0, cut).trimEnd()
  const rest = (window.slice(cut) + s.slice(limit)).trimStart()

  if (!line) {
    const hard = s.slice(0, limit)
    return { line: hard.trimEnd(), rest: s.slice(limit).trimStart() }
  }

  return { line, rest }
}

function isFillableTimestamp(
  lines: string[],
  selectedLineIndices: Set<number>,
  index: number
): boolean {
  if (!selectedLineIndices.has(index)) return false
  if (!isTimestampRow(lines[index] ?? '')) return false
  const nextLine = findNextNonEmptyLine(lines, index)
  if (nextLine != null && !isTimestampRow(nextLine)) return false
  return true
}

function getAutoSpanCount(
  lines: string[],
  selectedLineIndices: Set<number>,
  startIndex: number,
  text: string
): number {
  const charCount = text.length
  if (charCount === 0) return 1

  const targetFrames = (charCount * FPS) / MAX_CPS
  let frames = 0
  let count = 0

  for (let i = startIndex; i < lines.length; i++) {
    if (!isTimestampRow(lines[i] ?? '')) continue
    if (!isFillableTimestamp(lines, selectedLineIndices, i)) break

    const durationFrames = getTimestampDurationFrames(lines[i] ?? '')
    if (durationFrames == null) break
    frames += Math.max(0, durationFrames)
    count += 1
    if (frames >= targetFrames) break
  }

  return Math.max(1, count)
}

export function fillSelectedTimestampLines(
  lines: string[],
  selectedLineIndices: Set<number>,
  paragraph: string,
  options: FillSubsOptions = {}
): FillSubsResult {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS)
  const limit = Math.max(1, maxChars)
  const inline = options.inline ?? false

  let remaining = normalizeParagraph(paragraph)
  if (!remaining) {
    return { lines: [...lines], remaining: '' }
  }

  if (inline) {
    const outLines: string[] = []
    let spanText: string | null = null
    let spanRemaining = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      outLines.push(line)

      if (!isFillableTimestamp(lines, selectedLineIndices, i)) {
        if (isTimestampRow(line)) {
          spanText = null
          spanRemaining = 0
        }
        continue
      }

      if (spanRemaining > 0 && spanText) {
        outLines.push(spanText)
        spanRemaining -= 1
        continue
      }

      if (!remaining) continue

      const { line: fillLine, rest } = takeLine(remaining, limit)
      remaining = rest

      if (!fillLine) continue
      outLines.push(fillLine)

      const spanCount = getAutoSpanCount(
        lines,
        selectedLineIndices,
        i,
        fillLine
      )
      spanText = fillLine
      spanRemaining = Math.max(0, spanCount - 1)
    }

    return { lines: outLines, remaining }
  }

  const prependLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue

    if (!remaining) continue

    const { line: fillLine, rest } = takeLine(remaining, limit)
    remaining = rest

    if (fillLine) prependLines.push(fillLine)
  }

  return { lines: [...prependLines, ...lines], remaining }
}
