import { FPS, MAX_CPS, TSV_RE, parseTimecodeToFrames } from './subtitles'
import {
  analyzeDoubleQuoteSpan,
  countDoubleQuotes,
  hasLeadingDoubleQuote,
  hasTrailingDoubleQuote,
} from './doubleQuoteSpan'

export type FillSubsOptions = {
  maxChars?: number
  inline?: boolean
  noSplitAbbreviations?: string[]
}

export type FillSubsResult = {
  lines: string[]
  remaining: string
  chosenCps?: number
}

const DEFAULT_MAX_CHARS = 54
const DEFAULT_NO_SPLIT_ABBREVIATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'U.S.']
const MIN_TARGET_CPS = 10
const MAX_SPAN_PER_LINE = 3
const MIN_COMMA_SPLIT_CHARS = 12
const MIN_COMMA_SPLIT_WORDS = 2
const MIN_WITH_SPLIT_LEFT_CHARS = 12
const MIN_WITH_SPLIT_LEFT_WORDS = 2

const CONJ_RE = /\b(and|but|or|so|yet|nor)\b/i
const CLAUSE_START_RE =
  /^\s*(?:I|you|we|they|he|she|it|this|that|there)\b/i
const THAT_RE = /\b(that)\b/i
const WHO_RE = /\b(who|whom|whose|who's)\b/i
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
const PRONOUN_RE = /^(?:me|you|him|her|us|them|it|this|that|there)\b/i
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
const DIALOGUE_TAG_VERBS = ['said', 'asked', 'replied', 'told']

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildNoSplitAbbrevRe(abbreviations: string[]): RegExp | null {
  const tokens = abbreviations
    .map((abbr) => abbr.trim())
    .filter((abbr) => abbr !== '' && /\.$/.test(abbr))
    .map((abbr) => escapeRegExp(abbr))

  if (tokens.length === 0) return null
  return new RegExp(`(?:^|\\s)(?:${tokens.join('|')})$`, 'i')
}

function hasNoSplitUsAbbreviation(abbreviations: string[]): boolean {
  return abbreviations.some((abbr) => abbr.trim().toLowerCase() === 'u.s.')
}

function isNoSplitAbbrevEnding(text: string, matcher: RegExp | null): boolean {
  if (!matcher) return false
  return matcher.test(text)
}

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
  return ch === '"'
}

function isPunctForQuote(ch: string): boolean {
  return (
    STRONG_PUNCT.has(ch) ||
    SEMICOLON_PUNCT.has(ch) ||
    COMMA_PUNCT.has(ch) ||
    ch === '-'
  )
}

function isDialogueTagStart(text: string): boolean {
  const trimmed = text.trimStart().replace(/^["']\s*/, '')
  const tokens = trimmed.split(/\s+/).filter(Boolean).slice(0, 3)
  if (tokens.length < 2) return false

  const clean = (value: string) => value.replace(/[.,!?;:]+$/g, '').toLowerCase()
  const verb1 = clean(tokens[1] ?? '')
  if (DIALOGUE_TAG_VERBS.includes(verb1)) return true

  const verb2 = clean(tokens[2] ?? '')
  return DIALOGUE_TAG_VERBS.includes(verb2)
}

function endsWithQuestionOrExclaim(text: string): boolean {
  return /[!?]["']?\s*$/.test(text.trimEnd())
}

function isSentenceBoundaryChar(ch: string): boolean {
  return ch === '.' || ch === '!' || ch === '?'
}

function findRightmostStrongPunct(
  window: string,
  noSplitAbbrevMatcher: RegExp | null
): number {
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
    if (!left || !right) continue
    if (ch === '.' && isNoSplitAbbrevEnding(left, noSplitAbbrevMatcher)) continue
    if (isToVerbSplit(left, right)) continue
    return cut
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

// List-aware comma handling.
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
    if (left.length < MIN_COMMA_SPLIT_CHARS) continue
    const leftWords = left.split(/\s+/).filter(Boolean)
    if (leftWords.length < MIN_COMMA_SPLIT_WORDS) continue

    if (isListComma(window, i)) continue
    return cut
  }
  return -1
}

function findRightmostListTailLead(window: string, nextText: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] !== ',') continue

    const left = window.slice(0, i + 1).trimEnd()
    const right = (window.slice(i + 1) + nextText).trimStart()
    if (!left || !right) continue
    if (!/^(and|or|nor)\b/i.test(right)) continue
    if (/^(and|or|nor)\s+\S+\s+(before|after|while|like)\b/i.test(right)) {
      continue
    }
    return i + 1
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

function canSplitBeforeWho(left: string): boolean {
  const trimmed = left.trimEnd()
  if (!trimmed) return false

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false

  const lastWord = (words[words.length - 1] ?? '').toLowerCase()
  if (!lastWord) return false
  if (
    SENTENCE_VERB_RE.test(lastWord) ||
    THAT_SPLIT_VERB_RE.test(lastWord) ||
    CONJ_RE.test(lastWord) ||
    lastWord === 'to'
  ) {
    return false
  }

  return true
}

function findRightmostWhoStart(window: string): number {
  let best = -1
  const re = new RegExp(WHO_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length

    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    const right = window.slice(start).trimStart()
    if (!left || !right) continue
    if (!canSplitBeforeWho(left)) continue

    best = start
  }
  return best
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
    const tailWords = tail.split(/\s+/).filter(Boolean).slice(0, 3)
    if (tailWords.length > 0) {
      const candidate = `${left} ${tailWords.join(' ')}`
      if (candidate.length <= window.length) continue
    }

    best = start
  }
  return best
}

function findRightmostSpace(window: string, nextText: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] !== ' ') continue

    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = (window.slice(cut) + nextText).trimStart()
    if (!left || !right) continue
    if (isToVerbSplit(left, right)) continue
    return cut
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

function findSentenceBoundaryCut(
  window: string,
  nextText: string,
  noSplitAbbrevMatcher: RegExp | null
): number {
  for (let i = 0; i < window.length; i++) {
    const ch = window[i]
    if (!isSentenceBoundaryChar(ch)) continue
    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = (window.slice(cut) + nextText).trimStart()
    if (!left || !right) continue
    if (ch === '.' && isNoSplitAbbrevEnding(left, noSplitAbbrevMatcher)) continue
    if ((ch === '?' || ch === '!') && isDialogueTagStart(right)) {
      let hasLaterBoundary = false
      for (let j = i + 1; j < window.length; j++) {
        if (isSentenceBoundaryChar(window[j])) {
          hasLaterBoundary = true
          break
        }
      }
      if (hasLaterBoundary) continue
    }
    return cut
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

function isToVerbSplit(left: string, right: string): boolean {
  if (!/\bto$/i.test(left)) return false
  const firstWord = right.split(/\s+/)[0] ?? ''
  if (!/^[A-Za-z]+$/.test(firstWord)) return false
  if (DET_RE.test(firstWord)) return false
  if (PRONOUN_RE.test(firstWord)) return false
  return true
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

// Low-priority fallback: split before "with", but avoid tiny heads.
function findRightmostWithStart(window: string, nextText: string): number {
  let best = -1
  const re = /\bwith\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    const right = (window.slice(start) + nextText).trimStart()
    if (!left || !right) continue
    if (left.length < MIN_WITH_SPLIT_LEFT_CHARS) continue
    if (left.split(/\s+/).filter(Boolean).length < MIN_WITH_SPLIT_LEFT_WORDS) {
      continue
    }
    if (!/^with\b/i.test(right)) continue
    if (/^with\b\s*$/i.test(right)) continue
    best = start
  }
  return best
}

function findBestCut(
  window: string,
  nextText: string,
  noSplitAbbrevMatcher: RegExp | null
): number {
  // 1) Strong punctuation boundaries.
  const sentenceCut = findSentenceBoundaryCut(window, nextText, noSplitAbbrevMatcher)
  if (sentenceCut >= 0) return sentenceCut

  const strongCut = findRightmostStrongPunct(window, noSplitAbbrevMatcher)
  if (strongCut >= 0) return strongCut

  const semicolonCut = findRightmostPunct(window, SEMICOLON_PUNCT)
  if (semicolonCut >= 0) return semicolonCut

  // 2) Mid-priority syntactic/list boundaries.
  const commaCut = findRightmostNonListComma(window, nextText)
  if (commaCut >= 0) return commaCut

  const onHowCut = findRightmostOnHowBreak(window)
  if (onHowCut >= 0) return onHowCut

  const conjCut = findRightmostConjunctionStart(window)
  if (conjCut >= 0) return conjCut

  const whoCut = findRightmostWhoStart(window)
  if (whoCut >= 0) return whoCut

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

  const listTailCut = findRightmostListTailLead(window, nextText)
  if (listTailCut >= 0) return listTailCut

  // 3) Last-resort lexical/space fallback boundaries.
  const withCut = findRightmostWithStart(window, nextText)
  if (withCut >= 0) return withCut

  const spaceCut = findRightmostSpace(window, nextText)
  if (spaceCut >= 0) return spaceCut

  return window.length
}

function takeLine(
  text: string,
  limit: number,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean,
  options: { allowHeuristicSplitsWhenFits?: boolean } = {}
): { line: string; rest: string } {
  const s = text.trimStart()
  if (!s) return { line: '', rest: '' }
  const allowHeuristicSplitsWhenFits =
    options.allowHeuristicSplitsWhenFits ?? false

  if (
    s.length <= limit &&
    countDoubleQuotes(s) > 0 &&
    countDoubleQuotes(s) % 2 === 0
  ) {
    return normalizeSplit(s.trimEnd(), '')
  }

  if (s.length <= limit) {
    const sentenceCut = findSentenceBoundaryCut(s, '', noSplitAbbrevMatcher)
    if (sentenceCut > 0 && sentenceCut < s.length) {
      const left = s.slice(0, sentenceCut).trimEnd()
      const right = s.slice(sentenceCut).trimStart()
      if (
        left &&
        right &&
        endsWithQuestionOrExclaim(left) &&
        isDialogueTagStart(right)
      ) {
        return normalizeSplit(s.trimEnd(), '')
      }
      if (left && right && !/["']\s*$/.test(left) && !/^["']/.test(right)) {
        const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
          left,
          right,
          noSplitAbbrevMatcher,
          noSplitUsAbbreviation
        )
        return normalizeSplit(adjusted.line, adjusted.rest)
      }
    }

    if (!allowHeuristicSplitsWhenFits) {
      return normalizeSplit(s.trimEnd(), '')
    }

    const toVerbCut = findRightmostToVerbObjectBreak(s, '')
    if (toVerbCut > 0 && toVerbCut < s.length) {
      const left = s.slice(0, toVerbCut).trimEnd()
      const right = s.slice(toVerbCut).trimStart()
      if (left && right) {
        const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
          left,
          right,
          noSplitAbbrevMatcher,
          noSplitUsAbbreviation
        )
        return normalizeSplit(adjusted.line, adjusted.rest)
      }
    }

    const clauseLeadCut = findRightmostClauseStarterLead(s, '')
    if (clauseLeadCut > 0 && clauseLeadCut < s.length) {
      const left = s.slice(0, clauseLeadCut).trimEnd()
      const right = s.slice(clauseLeadCut).trimStart()
      if (left && right) {
        const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
          left,
          right,
          noSplitAbbrevMatcher,
          noSplitUsAbbreviation
        )
        return normalizeSplit(adjusted.line, adjusted.rest)
      }
    }

    const copularCut = findRightmostCopularBreak(s, '')
    if (copularCut > 0 && copularCut < s.length) {
      const left = s.slice(0, copularCut).trimEnd()
      const right = s.slice(copularCut).trimStart()
      if (left && right) {
        const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
          left,
          right,
          noSplitAbbrevMatcher,
          noSplitUsAbbreviation
        )
        return normalizeSplit(adjusted.line, adjusted.rest)
      }
    }

    const copularLeadCut = findRightmostCopularLead(s, '')
    if (copularLeadCut > 0 && copularLeadCut < s.length) {
      const left = s.slice(0, copularLeadCut).trimEnd()
      const right = s.slice(copularLeadCut).trimStart()
      if (left && right) {
        const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
          left,
          right,
          noSplitAbbrevMatcher,
          noSplitUsAbbreviation
        )
        return normalizeSplit(adjusted.line, adjusted.rest)
      }
    }

    return normalizeSplit(s.trimEnd(), '')
  }

  const window = s.slice(0, limit)
  const cut = adjustCutForTrailingQuote(
    window,
    findBestCut(window, s.slice(limit), noSplitAbbrevMatcher)
  )

  const line = window.slice(0, cut).trimEnd()
  const rest = (window.slice(cut) + s.slice(limit)).trimStart()

  if (!line) {
    const hard = s.slice(0, limit)
    const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
      hard.trimEnd(),
      s.slice(limit).trimStart(),
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
    )
    return normalizeSplit(adjusted.line, adjusted.rest)
  }

  const adjusted = adjustSplitForNoSplitAbbrevAndQuotes(
    line,
    rest,
    noSplitAbbrevMatcher,
    noSplitUsAbbreviation
  )
  return normalizeSplit(adjusted.line, adjusted.rest)
}

function normalizeQuoteOnlyHead(line: string, rest: string): { line: string; rest: string } {
  if (line.trim() !== '"') return { line, rest }
  if (!rest) return { line: '', rest: '"' }
  if (rest.trimStart().startsWith('"')) return { line: '', rest }
  return { line: '', rest: `"${rest}` }
}

function normalizeTrailingConjunctionHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const match = trimmed.match(/^(.*)\s+(and|but|or|so|yet|nor)$/i)
  if (!match) return { line, rest }

  const left = (match[1] ?? '').trimEnd()
  const conjunction = (match[2] ?? '').trim().toLowerCase()
  if (!left) return { line, rest }

  if (!rest) return { line: left, rest: conjunction }
  if (rest.trimStart().toLowerCase().startsWith(`${conjunction} `)) {
    return { line: left, rest }
  }
  return { line: left, rest: `${conjunction} ${rest}` }
}

function normalizeTrailingArticleHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const match = trimmed.match(/^(.*)\s+(the)$/i)
  if (!match) return { line, rest }

  const left = (match[1] ?? '').trimEnd()
  const article = (match[2] ?? '').trim().toLowerCase()
  if (!left) return { line, rest }

  // Keep very short lead-ins intact (e.g. "Next, we review the").
  const leftWordCount = left
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean).length
  if (leftWordCount <= 3) return { line, rest }

  if (!rest) return { line: left, rest: article }
  if (rest.trimStart().toLowerCase().startsWith(`${article} `)) {
    return { line: left, rest }
  }
  return { line: left, rest: `${article} ${rest}` }
}

function normalizeTrailingSubordinatorHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const match = trimmed.match(/^(.*)\s+(before|after|while|like)$/i)
  if (!match) return { line, rest }

  const left = (match[1] ?? '').trimEnd()
  const word = (match[2] ?? '').trim().toLowerCase()
  if (!left) return { line, rest }

  if (!rest) return { line: left, rest: word }
  if (rest.trimStart().toLowerCase().startsWith(`${word} `)) {
    return { line: left, rest }
  }
  return { line: left, rest: `${word} ${rest}` }
}

function normalizeSplit(line: string, rest: string): { line: string; rest: string } {
  const quoteNormalized = normalizeQuoteOnlyHead(line, rest)
  const conjunctionNormalized = normalizeTrailingConjunctionHead(
    quoteNormalized.line,
    quoteNormalized.rest
  )
  const articleNormalized = normalizeTrailingArticleHead(
    conjunctionNormalized.line,
    conjunctionNormalized.rest
  )
  return normalizeTrailingSubordinatorHead(
    articleNormalized.line,
    articleNormalized.rest
  )
}

export function __testTakeLine(
  text: string,
  limit: number,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean,
  options: { allowHeuristicSplitsWhenFits?: boolean } = {}
): { line: string; rest: string } {
  return takeLine(
    text,
    limit,
    noSplitAbbrevMatcher,
    noSplitUsAbbreviation,
    options
  )
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

function adjustSplitForNoSplitAbbrev(
  line: string,
  rest: string,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const trimmedLine = line.trimEnd()
  const trimmedRest = rest.trimStart()

  const usMatch = noSplitUsAbbreviation && /(?:^|\s)U\.$/i.test(trimmedLine)
  const sMatch = /^S\./i.test(trimmedRest)
  if (usMatch && sMatch) {
    const token = trimmedRest.match(/^S\./i)?.[0] ?? 'S.'
    const nextRest = trimmedRest.slice(token.length).trimStart()
    return { line: `${trimmedLine}${token}`, rest: nextRest }
  }

  if (!isNoSplitAbbrevEnding(trimmedLine, noSplitAbbrevMatcher)) {
    return { line, rest }
  }
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

function mergeNoSplitPhrases(
  line: string,
  rest: string
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const trimmedLine = line.trimEnd()
  const trimmedRest = rest.trimStart()
  const appendToken = (base: string, token: string) => {
    const noSpace = /(?:---|—|–)$/.test(base)
    return noSpace ? `${base}${token}` : `${base} ${token}`
  }

  const endsWithSentence =
    /[.!?]["']?\s*$/.test(trimmedLine) || /[.!?]["']?\s*$/.test(line)

  const thatMatch = trimmedRest.match(/^that(?:'s)?\b/i)
  if (thatMatch && !endsWithSentence && !canSplitBeforeThat(trimmedLine)) {
    const token = thatMatch[0]
    const nextRest = trimmedRest.slice(token.length).trimStart()
    return { line: appendToken(trimmedLine, token), rest: nextRest }
  }

  if (/\blike$/i.test(trimmedLine)) {
    const thatMatch = trimmedRest.match(/^that\b/i)
    if (thatMatch) {
      const token = thatMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }
  }

  if (/\beven$/i.test(trimmedLine)) {
    const soMatch = trimmedRest.match(/^so\b,?/i)
    if (soMatch) {
      const token = soMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }

    const thoughMatch = trimmedRest.match(/^though\b/i)
    if (thoughMatch) {
      const token = thoughMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }
  }

  if (/^(?:and|but|or|so|yet|nor)$/i.test(trimmedLine)) {
    const thatMatch = trimmedRest.match(/^that(?:'s)?\b/i)
    if (thatMatch) {
      const token = thatMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }
  }

  return { line, rest }
}

function adjustSplitForQuotes(
  line: string,
  rest: string
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const leftCount = countDoubleQuotes(line)
  const rightCount = countDoubleQuotes(rest)
  if (leftCount % 2 !== 1 || rightCount % 2 !== 1) {
    return { line, rest }
  }

  let nextLine = line
  let nextRest = rest
  if (!hasTrailingDoubleQuote(nextLine)) {
    nextLine = `${nextLine}"`
  }
  if (!hasLeadingDoubleQuote(nextRest)) {
    nextRest = `"${nextRest}`
  }

  return { line: nextLine, rest: nextRest }
}

function adjustSplitForNoSplitAbbrevAndQuotes(
  line: string,
  rest: string,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean
): { line: string; rest: string } {
  const phraseAdjusted = mergeNoSplitPhrases(line, rest)
  const abbrevAdjusted = adjustSplitForNoSplitAbbrev(
    phraseAdjusted.line,
    phraseAdjusted.rest,
    noSplitAbbrevMatcher,
    noSplitUsAbbreviation
  )
  return adjustSplitForQuotes(abbrevAdjusted.line, abbrevAdjusted.rest)
}

type QuoteMeta = {
  isOpening: boolean
  isClosing: boolean
  isWrapped: boolean
}

function getQuoteMeta(rawLine: string, quoteOpen: boolean): QuoteMeta {
  const quoteInfo = analyzeDoubleQuoteSpan(rawLine, quoteOpen)
  if (quoteInfo.quoteCount % 2 === 0) {
    return { isOpening: false, isClosing: false, isWrapped: false }
  }
  return {
    isOpening: quoteInfo.isOpeningAtStart,
    isClosing: quoteInfo.isClosingAtEnd,
    isWrapped: quoteInfo.hasLeadingQuote && quoteInfo.hasTrailingQuote,
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

  if (
    (quoteOpen || shouldOpen || shouldClose) &&
    !hasLeadingDoubleQuote(text)
  ) {
    text = `"${text}`
  }

  if (
    (quoteOpen || shouldOpen || shouldClose) &&
    !hasTrailingDoubleQuote(text)
  ) {
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
  dryRun: boolean,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean
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

    const { line: fillLine, rest } = takeLine(
      remaining,
      limit,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
    )
    remaining = rest

    if (!fillLine) continue
    if (fillLine.trim() === '"') {
      if (remaining && !remaining.trimStart().startsWith('"')) {
        remaining = `"${remaining}`
      }
      continue
    }
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
  limit: number,
  noSplitAbbrevMatcher: RegExp | null,
  noSplitUsAbbreviation: boolean
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
    true,
    noSplitAbbrevMatcher,
    noSplitUsAbbreviation
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
      true,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
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
  const noSplitAbbreviations =
    options.noSplitAbbreviations ?? DEFAULT_NO_SPLIT_ABBREVIATIONS
  const noSplitAbbrevMatcher = buildNoSplitAbbrevRe(noSplitAbbreviations)
  const noSplitUsAbbreviation = hasNoSplitUsAbbreviation(noSplitAbbreviations)

  if (inline) {
    const targetCps = chooseTargetCps(
      lines,
      selectedLineIndices,
      paragraph,
      limit,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
    )
    const run = runInlineFill(
      lines,
      selectedLineIndices,
      paragraph,
      limit,
      targetCps,
      false,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
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

    const { line: fillLine, rest } = takeLine(
      remaining,
      limit,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
    )
    remaining = rest

    if (fillLine) prependLines.push(fillLine)
  }

  return { lines: [...prependLines, ...lines], remaining, chosenCps: undefined }
}
