import { FPS, MAX_CPS, TIME_RE, parseTimecodeToFrames } from './subtitles'

export type FillSubsOptions = {
  maxChars?: number
  inline?: boolean
}

export type FillSubsResult = {
  lines: string[]
  remaining: string
  chosenCps?: number
}

const DEFAULT_MAX_CHARS = 54
const MIN_TARGET_CPS = 10
const MAX_SPAN_PER_LINE = 3

const CONJ_RE = /\b(and|but|or|so|yet|for|nor)\b/i
const THAT_RE = /\b(that)\b/i
const COPULAR_RE = /\b(am|is|are|was|were)\b/i
const COPULAR_VERB_RE =
  /\b(give|make|take|help|let|get|keep|try|need|want|have)\b/i
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

function isListComma(window: string, index: number): boolean {
  const before = window.slice(0, index)
  const after = window.slice(index + 1)

  if (/^\s*(and|or|nor)\b/i.test(after) && before.includes(',')) return true
  if (/,\s*(and|or|nor)\b/i.test(after)) return true

  return false
}

function findRightmostNonListComma(window: string, nextText: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] !== ',') continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = window.slice(cut).trimStart()
    const hasNext = nextText.trimStart() !== ''
    if (!left) continue
    if (!right && !hasNext) continue

    if (isListComma(window, i)) continue
    return cut
  }
  return -1
}

function isCommaJoinedConjunction(window: string, index: number): boolean {
  const before = window.slice(0, index).trimEnd()
  return before.endsWith(',')
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
    if (isCommaJoinedConjunction(window, start)) continue
    if (
      m[0].toLowerCase() === 'so' &&
      window.slice(0, start).trimEnd().toLowerCase().endsWith('even')
    ) {
      continue
    }

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

function findRightmostCopularBreak(window: string, nextText: string): number {
  let best = -1
  const re = new RegExp(COPULAR_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, end).trimEnd()
    if (!left) continue
    const tail = (window.slice(end) + nextText).trimStart()
    if (!tail) continue
    if (!tail.match(COPULAR_VERB_RE)) continue

    best = end
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

function findBestCut(window: string, nextText: string): number {
  const strongCut = findRightmostStrongPunct(window)
  if (strongCut >= 0) return strongCut

  const semicolonCut = findRightmostPunct(window, SEMICOLON_PUNCT)
  if (semicolonCut >= 0) return semicolonCut

  const commaCut = findRightmostNonListComma(window, nextText)
  if (commaCut >= 0) return commaCut

  const conjCut = findRightmostConjunctionStart(window)
  if (conjCut >= 0) return conjCut

  const thatCut = findRightmostThatStart(window)
  if (thatCut >= 0) return thatCut

  const copularCut = findRightmostCopularBreak(window, nextText)
  if (copularCut >= 0) return copularCut

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
  const cut = adjustCutForTrailingQuote(
    window,
    findBestCut(window, s.slice(limit))
  )

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

function getSpanForTargetCps(
  lines: string[],
  selectedLineIndices: Set<number>,
  startIndex: number,
  text: string,
  targetCps: number
): { count: number; satisfied: boolean } {
  const charCount = text.length
  if (charCount === 0) return { count: 1, satisfied: true }
  if (!Number.isFinite(targetCps) || targetCps <= 0) {
    return { count: 1, satisfied: true }
  }

  const targetFrames = (charCount * FPS) / targetCps
  let frames = 0
  let count = 0

  for (let i = startIndex; i < lines.length; i++) {
    if (!isTimestampRow(lines[i] ?? '')) continue
    if (!isFillableTimestamp(lines, selectedLineIndices, i)) break

    const durationFrames = getTimestampDurationFrames(lines[i] ?? '')
    if (durationFrames == null) {
      const nextCount = Math.max(1, count + 1)
      const cappedCount = Math.min(nextCount, MAX_SPAN_PER_LINE)
      return { count: cappedCount, satisfied: true }
    }
    frames += Math.max(0, durationFrames)
    count += 1
    if (count >= MAX_SPAN_PER_LINE) {
      return { count: MAX_SPAN_PER_LINE, satisfied: frames >= targetFrames }
    }
    if (frames >= targetFrames) {
      return { count: Math.max(1, count), satisfied: true }
    }
  }

  return { count: Math.max(1, count), satisfied: false }
}

type FillRunResult = {
  lines: string[]
  remaining: string
  usedSlots: number
  overflow: boolean
}

function countQuotes(text: string): number {
  return (text.match(/"/g) ?? []).length
}

function hasLeadingQuote(text: string): boolean {
  return /^\s*"/.test(text)
}

function hasTrailingQuote(text: string): boolean {
  return /"\s*$/.test(text)
}

function stripTrailingQuote(text: string): string {
  let end = text.length
  while (end > 0 && /\s/.test(text[end - 1])) end -= 1
  if (end > 0 && text[end - 1] === '"') {
    return text.slice(0, end - 1) + text.slice(end)
  }
  return text
}

type QuoteMeta = {
  isOpening: boolean
  isClosing: boolean
  isWrapped: boolean
}

function getQuoteMeta(rawLine: string, quoteOpen: boolean): QuoteMeta {
  const quoteCount = countQuotes(rawLine)
  const isOdd = quoteCount % 2 === 1
  return {
    isOpening: isOdd && !quoteOpen,
    isClosing: isOdd && quoteOpen,
    isWrapped: hasLeadingQuote(rawLine) && hasTrailingQuote(rawLine),
  }
}

function applyQuoteCarry(
  rawLine: string,
  quoteOpen: boolean,
  meta: QuoteMeta,
  isFirstInSpan: boolean,
  isLastInSpan: boolean
): { text: string; quoteOpen: boolean } {
  let text = rawLine
  const shouldOpen = meta.isOpening || meta.isWrapped
  const shouldClose = meta.isClosing || meta.isWrapped

  if ((quoteOpen || shouldOpen || shouldClose) && !hasLeadingQuote(text)) {
    text = `"${text}`
  }

  if ((quoteOpen || shouldOpen || shouldClose) && !hasTrailingQuote(text)) {
    text = `${text}"`
  }

  let nextQuoteOpen = quoteOpen
  if (shouldOpen && isFirstInSpan) {
    nextQuoteOpen = true
  } else if (shouldClose && isLastInSpan) {
    nextQuoteOpen = false
  }

  return { text, quoteOpen: nextQuoteOpen }
}

function runInlineFill(
  lines: string[],
  selectedLineIndices: Set<number>,
  paragraph: string,
  limit: number,
  targetCps: number,
  dryRun: boolean
): FillRunResult {
  let remaining = normalizeParagraph(paragraph)
  if (!remaining) {
    return { lines: dryRun ? [] : [...lines], remaining: '', usedSlots: 0, overflow: false }
  }

  const outLines: string[] = []
  const payloads = new Map<number, string>()
  let spanText: string | null = null
  let spanMeta: QuoteMeta | null = null
  let spanTotal = 0
  let spanIndex = 0
  let spanRemaining = 0
  let usedSlots = 0
  let overflow = false
  let quoteOpen = false
  let lastFilledIndex: number | null = null
  let lastPayload: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!isFillableTimestamp(lines, selectedLineIndices, i)) {
      if (isTimestampRow(line)) {
        spanText = null
        spanRemaining = 0
      }
      continue
    }

    if (spanRemaining > 0 && spanText && spanMeta) {
      spanIndex += 1
      const isLastInSpan = spanRemaining === 1
      const carried = applyQuoteCarry(
        spanText,
        quoteOpen,
        spanMeta,
        false,
        isLastInSpan
      )
      quoteOpen = carried.quoteOpen
      payloads.set(i, carried.text)
      lastPayload = carried.text
      lastFilledIndex = i
      spanRemaining -= 1
      usedSlots += 1
      continue
    }

    if (!remaining) continue

    const { line: fillLine, rest } = takeLine(remaining, limit)
    remaining = rest

    if (!fillLine) continue
    const quoteMeta = getQuoteMeta(fillLine, quoteOpen)
    spanMeta = quoteMeta
    usedSlots += 1

    const spanInfo = getSpanForTargetCps(
      lines,
      selectedLineIndices,
      i,
      fillLine,
      targetCps
    )
    if (!spanInfo.satisfied) overflow = true
    spanText = fillLine
    spanTotal = Math.max(1, spanInfo.count)
    spanIndex = 0
    spanRemaining = Math.max(0, spanTotal - 1)
    const carried = applyQuoteCarry(
      fillLine,
      quoteOpen,
      quoteMeta,
      true,
      spanTotal === 1
    )
    quoteOpen = carried.quoteOpen
    payloads.set(i, carried.text)
    lastPayload = carried.text
    lastFilledIndex = i
  }

  if (!dryRun && lastPayload && lastFilledIndex != null) {
    for (let i = lastFilledIndex + 1; i < lines.length; i += 1) {
      if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue
      if (payloads.has(i)) continue
      payloads.set(i, lastPayload)
    }
  }

  if (!dryRun) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      outLines.push(line)
      if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue
      const payload = payloads.get(i)
      if (payload) outLines.push(payload)
    }
  }

  return { lines: outLines, remaining, usedSlots, overflow }
}

function countFillableSlots(
  lines: string[],
  selectedLineIndices: Set<number>
): number {
  let count = 0
  for (let i = 0; i < lines.length; i += 1) {
    if (isFillableTimestamp(lines, selectedLineIndices, i)) count += 1
  }
  return count
}

function chooseTargetCps(
  lines: string[],
  selectedLineIndices: Set<number>,
  paragraph: string,
  limit: number
): number {
  const maxCps = MAX_CPS
  const minCps = MIN_TARGET_CPS
  const totalSlots = countFillableSlots(lines, selectedLineIndices)
  if (totalSlots === 0) return maxCps

  const runAtMax = runInlineFill(
    lines,
    selectedLineIndices,
    paragraph,
    limit,
    maxCps,
    true
  )
  if (runAtMax.overflow) return maxCps

  let low = minCps
  let high = maxCps
  let best = maxCps
  let bestSlots = runAtMax.usedSlots

  if (bestSlots >= totalSlots) return maxCps

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    const run = runInlineFill(
      lines,
      selectedLineIndices,
      paragraph,
      limit,
      mid,
      true
    )
    if (run.overflow) {
      low = mid
      continue
    }
    if (run.usedSlots > bestSlots) {
      bestSlots = run.usedSlots
      best = mid
    } else if (run.usedSlots === bestSlots && mid < best) {
      best = mid
    }
    high = mid
  }

  return best
}

export function fillSelectedTimestampLines(
  lines: string[],
  selectedLineIndices: Set<number>,
  paragraph: string,
  options: FillSubsOptions = {}
): FillSubsResult {
  // Inline fill rules:
  // - Normalize input, split lines with list-aware punctuation.
  // - Choose target CPS (<= MAX_CPS) via dry-run to fill max slots without overflow.
  // - Enforce MIN_TARGET_CPS floor and MAX_SPAN_PER_LINE cap.
  // - Repeat line spans across consecutive slots; tail-fill repeats last line into trailing slots.
  // - Carry quotes by fully wrapping each repeated line inside quoted spans.
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS)
  const limit = Math.max(1, maxChars)
  const inline = options.inline ?? true

  if (inline) {
    const targetCps = chooseTargetCps(
      lines,
      selectedLineIndices,
      paragraph,
      limit
    )
    const run = runInlineFill(
      lines,
      selectedLineIndices,
      paragraph,
      limit,
      targetCps,
      false
    )
    return { lines: run.lines, remaining: run.remaining, chosenCps: targetCps }
  }

  let remaining = normalizeParagraph(paragraph)
  if (!remaining) {
    return { lines: [...lines], remaining: '', chosenCps: undefined }
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

  return { lines: [...prependLines, ...lines], remaining, chosenCps: undefined }
}
