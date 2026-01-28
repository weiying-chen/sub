import { FPS, MAX_CPS, TSV_RE, parseTimecodeToFrames } from './subtitles'

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

const CONJ_RE = /\b(and|but|or|so|yet|nor)\b/i
const CLAUSE_START_RE =
  /^\s*(?:I|you|we|they|he|she|it|this|that|there)\b/i
const THAT_RE = /\b(that)\b/i
const THAT_SPLIT_VERB_RE =
  /\b(?:say|says|said|tell|tells|told|ask|asks|asked|think|thinks|thought|know|knows|knew|realize|realizes|realized|feel|feels|felt|hope|hopes|hoped|decide|decides|decided|learn|learns|learned|hear|hears|heard|believe|believes|believed|suspect|suspects|suspected|guess|guesses|guessed|remember|remembers|remembered|notice|notices|noticed|find|finds|found)\b/i
const THAT_SPLIT_OBJECT_RE =
  /^(?:me|you|him|her|us|them|it|this|that|there|someone|somebody|anyone|anybody|everyone|everybody|noone|nobody)$/i
const COPULAR_RE = /\b(am|is|are|was|were)\b/i
const COPULAR_VERB_START_RE =
  /^(?:give|make|take|help|let|get|keep|try|need|want|have)\b/i
const COPULAR_CLAUSE_START_RE =
  /^(?:to|how|why|what|who|where|when|whether|that|if)\b/i
const DET_RE =
  /^(?:the|a|an|this|that|these|those|my|your|his|her|our|their)\b/i
const CLAUSE_STARTER_RE =
  /^(?:because|since|as|although|though|while|if|when)\b/i
const CLAUSE_STARTER_ANY_RE =
  /\b(?:because|since|as|although|though|while|if|when)\b/i
const THAT_FOLLOW_PRONOUN_RE =
  /^(?:it|we|he|she|they|i|this|that|there)\b/i
const TO_VERB_HELPER_RE =
  /\b(?:have|has|had|need|needs|want|wants|wanted|going)\s+to\s+[A-Za-z]+$/i
const SENTENCE_VERB_RE =
  /\b(am|is|are|was|were|be|being|been|have|has|had|do|does|did|can|will|would|should|must)\b/i
const STRONG_PUNCT = new Set(['.', '?', '!', ':', '\u2014'])
const SEMICOLON_PUNCT = new Set([';'])
const COMMA_PUNCT = new Set([','])
const QUOTE_CHARS = new Set(['"'])
const NO_SPLIT_ABBREV_RE = /(?:^|\s)(?:Mr|Mrs|Ms|Dr)\.$|(?:^|\s)U\.S\.$/

export function normalizeParagraph(text: string): string {
  return text
    .replace(/\u2014/g, '---')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\r?\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function getTimestampDurationFrames(line: string): number | null {
  const m = line.match(TSV_RE)
  if (!m?.groups) return null
  const startFrames = parseTimecodeToFrames(m.groups.start)
  const endFrames = parseTimecodeToFrames(m.groups.end)
  if (startFrames == null || endFrames == null) return null
  if (endFrames < startFrames) return null
  return endFrames - startFrames
}

function isTimestampRow(line: string): boolean {
  return TSV_RE.test(line)
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
    if (/\d$/.test(window.slice(0, i)) && /^\d/.test(window.slice(i + 1))) {
      continue
    }

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

function isCommaJoinedConjunction(
  window: string,
  index: number,
  rest: string
): boolean {
  const before = window.slice(0, index).trimEnd()
  if (!before.endsWith(',')) return false
  if (CLAUSE_START_RE.test(rest)) return false
  return true
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
    const rest = window.slice(end)
    if (isCommaJoinedConjunction(window, start, rest)) continue
    if (
      m[0].toLowerCase() === 'so' &&
      window.slice(0, start).trimEnd().toLowerCase().endsWith('even')
    ) {
      continue
    }

    const left = window.slice(0, start).trimEnd()
    const right = window.slice(start).trimStart()
    if (!left || !right) continue
    const leftWords = left.split(/\s+/).filter(Boolean)
    if (leftWords.length === 1 && CONJ_RE.test(leftWords[0])) continue
    best = start
  }
  return best
}

function findRightmostOnHowBreak(window: string): number {
  const re = /\bon\s+how\b/gi
  let best = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const matchText = m[0]
    const howStart = start + matchText.lastIndexOf('how')
    const left = window.slice(0, howStart).trimEnd()
    const right = window.slice(howStart).trimStart()
    if (left && right) best = howStart
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
    if (left && right && canSplitBeforeThat(left)) best = start
  }
  return best
}

function canSplitBeforeThat(left: string): boolean {
  const trimmed = left.trimEnd()
  if (!trimmed) return false

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false

  const minIndex = Math.max(0, words.length - 3)
  for (let i = words.length - 1; i >= minIndex; i--) {
    const word = words[i] ?? ''
    if (!THAT_SPLIT_VERB_RE.test(word)) continue

    const tail = words.slice(i + 1)
    if (tail.length === 0) return true
    if (tail.length === 1 && THAT_SPLIT_OBJECT_RE.test(tail[0] ?? '')) {
      return true
    }
  }

  return false
}

function findRightmostThatPronounBreak(
  window: string,
  nextText: string
): number {
  let best = -1
  const re = new RegExp(THAT_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length

    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, end).trimEnd()
    if (!left) continue
    const right = (window.slice(end) + nextText).trimStart()
    if (!right) continue
    if (canSplitBeforeThat(window.slice(0, start))) continue
    if (!THAT_FOLLOW_PRONOUN_RE.test(right)) continue

    best = end
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
    if (
      !COPULAR_VERB_START_RE.test(tail) &&
      !COPULAR_CLAUSE_START_RE.test(tail)
    ) {
      continue
    }

    best = end
  }

  return best
}

function startsWithCopularClause(text: string): boolean {
  const trimmed = text.trimStart()
  if (!trimmed) return false
  return COPULAR_CLAUSE_START_RE.test(trimmed) || CLAUSE_START_RE.test(trimmed)
}

function findRightmostCopularLead(window: string, nextText: string): number {
  let best = -1
  const re = new RegExp(COPULAR_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    if (!left) continue
    if (CLAUSE_STARTER_ANY_RE.test(left)) continue
    if (left.includes(',')) continue
    const wordCount = left.split(/\s+/).filter(Boolean).length
    if (wordCount < 3) continue
    const tail = (window.slice(end) + nextText).trimStart()
    if (!tail) continue
    if (startsWithCopularClause(tail)) continue

    best = start
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

function startsWithUppercase(text: string): boolean {
  const trimmed = text.trimStart()
  if (!trimmed) return false
  const first = trimmed.startsWith('"') ? trimmed.slice(1).trimStart() : trimmed
  const ch = first[0]
  if (!ch) return false
  return ch >= 'A' && ch <= 'Z'
}

function hasSentenceVerb(text: string): boolean {
  return SENTENCE_VERB_RE.test(text)
}

function findFragmentSentenceCut(window: string, nextText: string): number {
  for (let i = 0; i < window.length; i++) {
    const ch = window[i]
    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = (window.slice(cut) + nextText).trimStart()
    if (!left || !right) continue

    if (startsWithUppercase(left) && hasSentenceVerb(left)) continue
    if (startsWithUppercase(right)) return cut
  }
  return -1
}

function findRightmostToVerbObjectBreak(window: string, nextText: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] !== ' ') continue
    const left = window.slice(0, i).trimEnd()
    const right = (window.slice(i) + nextText).trimStart()
    if (!left || !right) continue
    if (COPULAR_CLAUSE_START_RE.test(right)) continue
    if (!DET_RE.test(right)) continue
    if (!TO_VERB_HELPER_RE.test(left)) continue
    return i + 1
  }
  return -1
}

function findRightmostClauseStarterLead(window: string, nextText: string): number {
  const re = /\b(?:because|since|as|although|though|while|if|when)\b/gi
  let best = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    if (!left) continue
    const right = (window.slice(start) + nextText).trimStart()
    if (!right) continue
    if (!CLAUSE_STARTER_RE.test(right)) continue

    best = start
  }
  return best
}

function findBestCut(window: string, nextText: string): number {
  const fragmentCut = findFragmentSentenceCut(window, nextText)
  if (fragmentCut >= 0) return fragmentCut

  const strongCut = findRightmostStrongPunct(window)
  if (strongCut >= 0) return strongCut

  const semicolonCut = findRightmostPunct(window, SEMICOLON_PUNCT)
  if (semicolonCut >= 0) return semicolonCut

  const commaCut = findRightmostNonListComma(window, nextText)
  if (commaCut >= 0) return commaCut

  const onHowCut = findRightmostOnHowBreak(window)
  if (onHowCut >= 0) return onHowCut

  const conjCut = findRightmostConjunctionStart(window)
  if (conjCut >= 0) return conjCut

  const thatCut = findRightmostThatStart(window)
  if (thatCut >= 0) return thatCut

  const thatPronounCut = findRightmostThatPronounBreak(window, nextText)
  if (thatPronounCut >= 0) return thatPronounCut

  const clauseLeadCut = findRightmostClauseStarterLead(window, nextText)
  if (clauseLeadCut >= 0) return clauseLeadCut

  const copularCut = findRightmostCopularBreak(window, nextText)
  if (copularCut >= 0) return copularCut

  const copularLeadCut = findRightmostCopularLead(window, nextText)
  if (copularLeadCut >= 0) return copularLeadCut

  const toVerbCut = findRightmostToVerbObjectBreak(window, nextText)
  if (toVerbCut >= 0) return toVerbCut

  const spaceCut = findRightmostSpace(window)
  if (spaceCut >= 0) return spaceCut

  return window.length
}

function takeLine(text: string, limit: number): { line: string; rest: string } {
  const s = text.trimStart()
  if (!s) return { line: '', rest: '' }

  if (s.length <= limit) {
    const fragmentCut = findFragmentSentenceCut(s, '')
    if (fragmentCut > 0 && fragmentCut < s.length) {
      const left = s.slice(0, fragmentCut).trimEnd()
      const right = s.slice(fragmentCut).trimStart()
      if (left && right && !/["']\s*$/.test(left) && !/^["']/.test(right)) {
        return adjustSplitForNoSplitAbbrevAndQuotes(left, right)
      }
    }

    const toVerbCut = findRightmostToVerbObjectBreak(s, '')
    if (toVerbCut > 0 && toVerbCut < s.length) {
      const left = s.slice(0, toVerbCut).trimEnd()
      const right = s.slice(toVerbCut).trimStart()
      if (left && right) {
        return adjustSplitForNoSplitAbbrevAndQuotes(left, right)
      }
    }

    const clauseLeadCut = findRightmostClauseStarterLead(s, '')
    if (clauseLeadCut > 0 && clauseLeadCut < s.length) {
      const left = s.slice(0, clauseLeadCut).trimEnd()
      const right = s.slice(clauseLeadCut).trimStart()
      if (left && right) {
        return adjustSplitForNoSplitAbbrevAndQuotes(left, right)
      }
    }

    const copularCut = findRightmostCopularBreak(s, '')
    if (copularCut > 0 && copularCut < s.length) {
      const left = s.slice(0, copularCut).trimEnd()
      const right = s.slice(copularCut).trimStart()
      if (left && right) {
        return adjustSplitForNoSplitAbbrevAndQuotes(left, right)
      }
    }

    const copularLeadCut = findRightmostCopularLead(s, '')
    if (copularLeadCut > 0 && copularLeadCut < s.length) {
      const left = s.slice(0, copularLeadCut).trimEnd()
      const right = s.slice(copularLeadCut).trimStart()
      if (left && right) {
        return adjustSplitForNoSplitAbbrevAndQuotes(left, right)
      }
    }
  }

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
    return adjustSplitForNoSplitAbbrevAndQuotes(
      hard.trimEnd(),
      s.slice(limit).trimStart()
    )
  }

  return adjustSplitForNoSplitAbbrevAndQuotes(line, rest)
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

function adjustSplitForNoSplitAbbrev(
  line: string,
  rest: string
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const trimmedLine = line.trimEnd()
  if (!NO_SPLIT_ABBREV_RE.test(trimmedLine)) return { line, rest }

  const trimmedRest = rest.trimStart()
  if (!/^[A-Za-z]/.test(trimmedRest)) return { line, rest }

  const lastSpace = trimmedLine.lastIndexOf(' ')
  if (lastSpace > 0) {
    const nextLine = trimmedLine.slice(0, lastSpace).trimEnd()
    const nextRest = `${trimmedLine.slice(lastSpace).trimStart()} ${trimmedRest}`
    if (nextLine) {
      return { line: nextLine, rest: nextRest.trimStart() }
    }
  }

  const wordMatch = trimmedRest.match(/^[^\s]+/)
  if (!wordMatch) return { line, rest }
  const word = wordMatch[0]
  const nextRest = trimmedRest.slice(word.length).trimStart()
  return { line: `${trimmedLine} ${word}`, rest: nextRest }
}

function adjustSplitForNoSplitPhrases(
  line: string,
  rest: string
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const trimmedLine = line.trimEnd()
  const trimmedRest = rest.trimStart()

  const thatMatch = trimmedRest.match(/^that(?:'s)?\b/i)
  if (thatMatch && !canSplitBeforeThat(trimmedLine)) {
    const token = thatMatch[0]
    const nextRest = trimmedRest.slice(token.length).trimStart()
    return { line: `${trimmedLine} ${token}`, rest: nextRest }
  }

  if (/\blike$/i.test(trimmedLine)) {
    const thatMatch = trimmedRest.match(/^that\b/i)
    if (thatMatch) {
      const token = thatMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: `${trimmedLine} ${token}`, rest: nextRest }
    }
  }

  if (/\beven$/i.test(trimmedLine)) {
    const thoughMatch = trimmedRest.match(/^though\b/i)
    if (thoughMatch) {
      const token = thoughMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: `${trimmedLine} ${token}`, rest: nextRest }
    }
  }

  if (/^(?:and|but|or|so|yet|nor)$/i.test(trimmedLine)) {
    const thatMatch = trimmedRest.match(/^that(?:'s)?\b/i)
    if (thatMatch) {
      const token = thatMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: `${trimmedLine} ${token}`, rest: nextRest }
    }
  }

  return { line, rest }
}

function adjustSplitForQuotes(
  line: string,
  rest: string
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const leftCount = countQuotes(line)
  const rightCount = countQuotes(rest)
  if (leftCount % 2 !== 1 || rightCount % 2 !== 1) {
    return { line, rest }
  }

  let nextLine = line
  let nextRest = rest
  if (!hasTrailingQuote(nextLine)) {
    nextLine = `${nextLine}"`
  }
  if (!hasLeadingQuote(nextRest)) {
    nextRest = `"${nextRest}`
  }

  return { line: nextLine, rest: nextRest }
}

function adjustSplitForNoSplitAbbrevAndQuotes(
  line: string,
  rest: string
): { line: string; rest: string } {
  const phraseAdjusted = adjustSplitForNoSplitPhrases(line, rest)
  const abbrevAdjusted = adjustSplitForNoSplitAbbrev(
    phraseAdjusted.line,
    phraseAdjusted.rest
  )
  return adjustSplitForQuotes(abbrevAdjusted.line, abbrevAdjusted.rest)
}

type QuoteMeta = {
  isOpening: boolean
  isClosing: boolean
  isWrapped: boolean
}

function getQuoteMeta(rawLine: string, quoteOpen: boolean): QuoteMeta {
  const hasLeading = hasLeadingQuote(rawLine)
  const hasTrailing = hasTrailingQuote(rawLine)
  return {
    isOpening: hasLeading && !quoteOpen,
    isClosing: hasTrailing && quoteOpen,
    isWrapped: hasLeading && hasTrailing,
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
  if (meta.isWrapped) {
    nextQuoteOpen = false
  } else if (shouldOpen && isFirstInSpan) {
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
    if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue

    if (!remaining) continue

    const { line: fillLine, rest } = takeLine(remaining, limit)
    remaining = rest

    if (fillLine) prependLines.push(fillLine)
  }

  return { lines: [...prependLines, ...lines], remaining, chosenCps: undefined }
}
