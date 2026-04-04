import { FPS, MAX_CPS, TSV_RE, parseTimecodeToFrames } from './subtitles'
import {
  analyzeDoubleQuoteSpan,
  countDoubleQuotes,
  hasLeadingDoubleQuote,
  hasTrailingDoubleQuote,
} from './doubleQuoteSpan'
import { DASH_VARIANTS_RE, EM_DASH } from './dashes'

export type FillSubsOptions = {
  maxChars?: number
  inline?: boolean
  altBreak?: boolean
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
const MIN_CLAUSE_START_SPLIT_CHARS = 12
const MIN_CLAUSE_START_SPLIT_WORDS = 2
const MIN_WITH_SPLIT_LEFT_CHARS = 12
const MIN_WITH_SPLIT_LEFT_WORDS = 2
const INFINITIVE_LEAD_NOUNS = new Set([
  'chance',
  'ability',
  'confidence',
  'opportunity',
  'way',
  'time',
  'decision',
  'desire',
  'plan',
])

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
const COORDINATED_PHRASE_STOP_RE =
  /^(?:who|whom|whose|that|which|to|with|for|from|before|after|while|because|since|if|when|as|would|could|should|will|can|may|might|must|is|are|was|were|be|being|been|am|do|does|did|has|have|had)\b/i
const TO_VERB_HELPER_RE =
  /\b(?:have|has|had|need|needs|want|wants|wanted|going)\s+to\s+[A-Za-z]+$/i
const SENTENCE_VERB_RE =
  /\b(am|is|are|was|were|be|being|been|have|has|had|do|does|did|can|will|would|should|must)\b/i
const THAT_CLAUSE_EXPLICIT_SUBJECT_RE =
  /^(?:it|he|she|they|we|i|this|there|my|your|his|her|our|their|the|a|an|someone|somebody|anyone|anybody|everyone|everybody|noone|nobody|no|something|anything|everything|nothing)\b/i
const STRONG_PUNCT = new Set(['.', '?', '!', ':', EM_DASH])
const SEMICOLON_PUNCT = new Set([';'])
const COMMA_PUNCT = new Set([','])
const DIALOGUE_TAG_VERBS = ['said', 'asked', 'replied', 'told']
const THAT_SPLIT_AUDIENCE_OBJECT_NOUNS = new Set([
  'people',
  'person',
  'audience',
  'audiences',
  'viewer',
  'viewers',
  'listener',
  'listeners',
  'reader',
  'readers',
  'crowd',
  'crowds',
  'folks',
])

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

function isMeridiemInnerSplit(left: string, right: string): boolean {
  return /(?:^|\s)[ap]\.$/i.test(left) && /^m\.(?:\s|$)/i.test(right)
}

function isDecimalInnerSplit(left: string, right: string): boolean {
  return /\d\.$/.test(left.trimEnd()) && /^\d/.test(right.trimStart())
}

function isMeridiemTimeSplit(left: string, right: string): boolean {
  return /\b\d(?::\d{2})?\s*$/i.test(left) &&
    /^(?:a\.m\.(?:\s|$)|p\.m\.(?:\s|$)|am\b|pm\b)/i.test(right)
}

function startsWithMeridiemTimePhrase(text: string): boolean {
  return /^\d(?::\d{2})?\s+(?:a\.m\.(?:\s|$)|p\.m\.(?:\s|$)|am\b|pm\b)/i.test(text)
}

function endsWithMeridiemAbbrev(text: string): boolean {
  return /(?:^|\s)(?:a\.m\.|p\.m\.|am|pm)$/i.test(text.trimEnd())
}

function endsWithPronounContraction(text: string): boolean {
  return /(?:^|\s)(?:i|you|we|they|he|she|it|that|there|what|who|where|when|why|how)'(?:d|ll|m|re|ve|s)$/i.test(
    text.trimEnd()
  )
}

function isPartialDottedAcronymSplit(left: string, right: string): boolean {
  return /(?:^|\s)[A-Z]\.$/.test(left.trimEnd()) && /^[A-Z]\./.test(right.trimStart())
}

function endsWithIncompleteLeadIn(text: string): boolean {
  const trimmed = text.trimEnd()
  return (
    /\baccording to$/i.test(trimmed) ||
    /\bbecause of$/i.test(trimmed) ||
    /\bdue to$/i.test(trimmed) ||
    /\binstead of$/i.test(trimmed) ||
    /\bsuch as$/i.test(trimmed) ||
    /\brather than$/i.test(trimmed) ||
    /\bbased on$/i.test(trimmed)
  )
}

function startsWithAcronymPhrase(text: string): boolean {
  const trimmed = text.trimStart()
  return /^(?:(?:[A-Z]\.){2,}|[A-Z]{2,}(?:'s|s)?\b)/.test(trimmed)
}

export function normalizeParagraph(text: string): string {
  return text
    .replace(DASH_VARIANTS_RE, '---')
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

function isEllipsisDot(text: string, index: number): boolean {
  return text[index] === '.' && (text[index - 1] === '.' || text[index + 1] === '.')
}

function isVeryShortSentenceTail(text: string): boolean {
  const trimmed = text.trimEnd()
  const words = trimmed
    .replace(/^["']+|["']+$/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean)
  return words.length <= 1
}

function looksLikeSentenceFragment(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true

  const firstAlpha = trimmed.match(/[A-Za-z]/)?.[0] ?? ''
  if (firstAlpha && firstAlpha === firstAlpha.toLowerCase()) return true

  const words = trimmed
    .replace(/^["']+|["']+$/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean)

  if (words.length <= 1) return true

  const firstWord = (words[0] ?? '').toLowerCase()
  if (!firstWord) return true
  if (CONJ_RE.test(firstWord)) return true

  return false
}

function shouldKeepShortSentencePairTogether(left: string, right: string): boolean {
  if (looksLikeSentenceFragment(left) || looksLikeSentenceFragment(right)) {
    return false
  }
  return true
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
    if (ch === '.' && isPartialDottedAcronymSplit(left, right)) continue
    if (ch === '.' && isDecimalInnerSplit(left, right)) continue
    if (ch === '.' && isMeridiemInnerSplit(left, right)) continue
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

function getPhraseWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase())
    .filter(Boolean)
}

function findCoordinationStopIndex(text: string): number {
  const trimmed = text.trimStart()
  if (!trimmed) return -1

  const tokens = trimmed.split(/\s+/)
  let offset = 0
  for (const token of tokens) {
    const clean = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
    if (clean && COORDINATED_PHRASE_STOP_RE.test(clean)) {
      return offset
    }
    offset += token.length + 1
  }

  return -1
}

function looksLikeCoordinatedPhraseFragment(text: string): boolean {
  const words = getPhraseWords(text)
  if (words.length === 0 || words.length > 8) return false
  if (CLAUSE_START_RE.test(text.trimStart())) return false
  if (words.some((word) => SENTENCE_VERB_RE.test(word))) return false
  if (words.some((word) => THAT_SPLIT_VERB_RE.test(word))) return false
  return true
}

function getTailPhraseCandidates(text: string): string[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let count = 2; count <= 4; count += 1) {
    if (tokens.length < count) continue
    out.push(tokens.slice(tokens.length - count).join(' '))
  }
  return out
}

function isLikelyCoordinatedPhraseSplit(
  left: string,
  right: string,
  conjunction: string
): boolean {
  if (!/^(and|or|nor)$/i.test(conjunction)) return false

  const stopIndex = findCoordinationStopIndex(right)
  if (stopIndex < 0) return false

  const rightPhrase = right.slice(0, stopIndex).trim()
  if (!new RegExp(`^${conjunction}\\b`, 'i').test(rightPhrase)) return false

  const leftFragment = left.trim()
  const rightFragment = rightPhrase.replace(new RegExp(`^${conjunction}\\b\\s*`, 'i'), '')
  if (!leftFragment || !rightFragment) return false

  const leftCandidates = [leftFragment, ...getTailPhraseCandidates(leftFragment)]
  return leftCandidates.some(
    (candidate) =>
      looksLikeCoordinatedPhraseFragment(candidate) &&
      looksLikeCoordinatedPhraseFragment(rightFragment)
  )
}

function findRightmostConjunctionStart(window: string, nextText: string): number {
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
    const right = (window.slice(start) + nextText).trimStart()
    if (!left || !right) continue
    const leftWords = left.split(/\s+/).filter(Boolean)
    if (leftWords.length === 1 && CONJ_RE.test(leftWords[0])) continue
    if (isLikelyCoordinatedPhraseSplit(left, right, m[0])) continue
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

function findRightmostCommaThatStart(window: string): number {
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
    if (!left || !right) continue
    if (!left.endsWith(',')) continue
    best = start
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

function shouldSplitBeforeThatClause(left: string, right: string): boolean {
  const trimmedLeft = left.trimEnd()
  const trimmedRight = right.trimStart()
  if (!trimmedLeft || !trimmedRight) return false
  if (!looksLikeThatClauseStart(trimmedRight)) return false

  const words = trimmedLeft.split(/\s+/).filter(Boolean)
  const lastWord = (words[words.length - 1] ?? '').toLowerCase()
  if (CONJ_RE.test(lastWord)) return false

  return true
}

function cleanWord(word: string): string {
  return word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase()
}

function looksLikeFiniteVerbToken(word: string): boolean {
  if (!word) return false
  if (SENTENCE_VERB_RE.test(word)) return true
  if (/^(?:felt|found|left|lost|made|paid|said|saw|went|won)$/i.test(word)) {
    return true
  }
  return /^[a-z]+(?:s|ed)$/.test(word)
}

function looksLikeThatClauseStart(right: string): boolean {
  const trimmedRight = right.trimStart()
  const thatMatch = trimmedRight.match(/^that\b\s*(.*)$/i)
  if (!thatMatch) return false

  const tail = thatMatch[1]?.trim() ?? ''
  if (!tail) return false

  const tokens = tail
    .split(/\s+/)
    .map(cleanWord)
    .filter(Boolean)
  if (tokens.length < 2) return false
  if (looksLikeFiniteVerbToken(tokens[0] ?? '')) return false

  const first = tokens[0] ?? ''
  const startsExplicitly =
    first === 'no' || THAT_CLAUSE_EXPLICIT_SUBJECT_RE.test(first)
  const maxVerbIndex = startsExplicitly ? 4 : 3

  for (let i = 1; i < tokens.length && i <= maxVerbIndex; i += 1) {
    if (looksLikeFiniteVerbToken(tokens[i] ?? '')) return true
  }

  return false
}

function isAudienceObjectTail(words: string[]): boolean {
  if (words.length === 1) {
    return THAT_SPLIT_AUDIENCE_OBJECT_NOUNS.has(cleanWord(words[0] ?? ''))
  }

  if (words.length === 2 && DET_RE.test(words[0] ?? '')) {
    return THAT_SPLIT_AUDIENCE_OBJECT_NOUNS.has(cleanWord(words[1] ?? ''))
  }

  return false
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
    if (isAudienceObjectTail(tail)) return true
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

function findRightmostThatClauseStart(
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

    const left = window.slice(0, start).trimEnd()
    const right = (window.slice(start) + nextText).trimStart()
    if (!left || !right) continue
    if (!shouldSplitBeforeThatClause(left, right)) continue

    best = start
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
    const leftWordCount = left.split(/\s+/).filter(Boolean).length
    if (
      left.length < MIN_CLAUSE_START_SPLIT_CHARS ||
      leftWordCount < MIN_CLAUSE_START_SPLIT_WORDS + 1
    ) {
      continue
    }
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

function endsWithClauseStarter(text: string): boolean {
  return /\b(?:because|since|as|although|though|while|if|when)$/i.test(
    text.trimEnd()
  )
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
    const rightConjunction = right.match(/^(and|or|nor)\b/i)?.[0] ?? ''
    if (rightConjunction && isLikelyCoordinatedPhraseSplit(left, right, rightConjunction)) {
      continue
    }
    if (endsWithIncompleteLeadIn(left)) continue
    if (isToVerbSplit(left, right)) continue
    if (isMeridiemTimeSplit(left, right)) continue
    if (startsWithMeridiemTimePhrase(right)) continue
    if (/\bto$/i.test(left) && DET_RE.test(right)) continue
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
    if (ch === '.' && isEllipsisDot(window, i)) continue
    const cut = i + 1
    const left = window.slice(0, cut).trimEnd()
    const right = (window.slice(cut) + nextText).trimStart()
    if (!left || !right) continue
    if (ch === '.' && isNoSplitAbbrevEnding(left, noSplitAbbrevMatcher)) continue
    if (ch === '.' && isPartialDottedAcronymSplit(left, right)) continue
    if (ch === '.' && isDecimalInnerSplit(left, right)) continue
    if (ch === '.' && isMeridiemInnerSplit(left, right)) continue
    if (
      isVeryShortSentenceTail(left) &&
      (isQuoteChar(window[cut] ?? '') || /["']\s*$/.test(left))
    ) {
      continue
    }
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

function startsWithInfinitiveClause(text: string): boolean {
  return /^to\s+[A-Za-z]+(?:\b|['-])/i.test(text.trimStart())
}

function endsWithInfinitiveLeadNoun(left: string): boolean {
  const words = left
    .trimEnd()
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase())
    .filter(Boolean)
  if (words.length === 0) return false
  return INFINITIVE_LEAD_NOUNS.has(words[words.length - 1])
}

function findRightmostInfinitiveLead(window: string, nextText: string): number {
  let best = -1
  const re = /\bto\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(window)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const prev = window[start - 1] ?? ''
    const next = window[end] ?? ''
    if ((prev && isWordChar(prev)) || (next && isWordChar(next))) continue

    const left = window.slice(0, start).trimEnd()
    if (!left) continue
    if (left.length < MIN_CLAUSE_START_SPLIT_CHARS) continue
    if (left.split(/\s+/).filter(Boolean).length < MIN_CLAUSE_START_SPLIT_WORDS) {
      continue
    }
    if (!endsWithInfinitiveLeadNoun(left)) continue

    const right = (window.slice(start) + nextText).trimStart()
    if (!right) continue
    if (!startsWithInfinitiveClause(right)) continue

    best = start
  }
  return best
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
    if (left.length < MIN_CLAUSE_START_SPLIT_CHARS) continue
    if (left.split(/\s+/).filter(Boolean).length < MIN_CLAUSE_START_SPLIT_WORDS) {
      continue
    }
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
): { cut: number; reason: string } {
  // 1) Strong punctuation boundaries.
  const sentenceCut = findSentenceBoundaryCut(window, nextText, noSplitAbbrevMatcher)
  if (sentenceCut >= 0) return { cut: sentenceCut, reason: 'sentence' }

  const strongCut = findRightmostStrongPunct(window, noSplitAbbrevMatcher)
  if (strongCut >= 0) return { cut: strongCut, reason: 'strong' }

  const semicolonCut = findRightmostPunct(window, SEMICOLON_PUNCT)
  if (semicolonCut >= 0) return { cut: semicolonCut, reason: 'semicolon' }

  // 2) Mid-priority syntactic/list boundaries.
  const commaCut = findRightmostNonListComma(window, nextText)
  if (commaCut >= 0) return { cut: commaCut, reason: 'comma' }

  const onHowCut = findRightmostOnHowBreak(window)
  if (onHowCut >= 0) return { cut: onHowCut, reason: 'onHow' }

  const conjCut = findRightmostConjunctionStart(window, nextText)
  if (conjCut >= 0) return { cut: conjCut, reason: 'conjunction' }

  const whoCut = findRightmostWhoStart(window)
  if (whoCut >= 0) return { cut: whoCut, reason: 'who' }

  const commaThatCut = findRightmostCommaThatStart(window)
  if (commaThatCut >= 0) return { cut: commaThatCut, reason: 'commaThat' }

  const thatClauseCut = findRightmostThatClauseStart(window, nextText)
  if (thatClauseCut >= 0) return { cut: thatClauseCut, reason: 'thatClause' }

  const thatCut = findRightmostThatStart(window)
  if (thatCut >= 0) return { cut: thatCut, reason: 'that' }

  const infinitiveLeadCut = findRightmostInfinitiveLead(window, nextText)
  if (infinitiveLeadCut >= 0) return { cut: infinitiveLeadCut, reason: 'infinitive' }

  const clauseLeadCut = findRightmostClauseStarterLead(window, nextText)
  if (clauseLeadCut >= 0) return { cut: clauseLeadCut, reason: 'clauseStarter' }

  const copularCut = findRightmostCopularBreak(window, nextText)
  if (copularCut >= 0) return { cut: copularCut, reason: 'copularBreak' }

  const copularLeadCut = findRightmostCopularLead(window, nextText)
  if (copularLeadCut >= 0) return { cut: copularLeadCut, reason: 'copularLead' }

  const toVerbCut = findRightmostToVerbObjectBreak(window, nextText)
  if (toVerbCut >= 0) return { cut: toVerbCut, reason: 'toVerb' }

  const listTailCut = findRightmostListTailLead(window, nextText)
  if (listTailCut >= 0) return { cut: listTailCut, reason: 'listTail' }

  // 3) Last-resort lexical/space fallback boundaries.
  const withCut = findRightmostWithStart(window, nextText)
  if (withCut >= 0) return { cut: withCut, reason: 'with' }

  const spaceCut = findRightmostSpace(window, nextText)
  if (spaceCut >= 0) return { cut: spaceCut, reason: 'space' }

  return { cut: window.length, reason: 'fallback' }
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

  // Long quoted segments should keep making progress instead of stalling on
  // the leading quote marker.
  if (s.startsWith('"') && s.length > limit && countDoubleQuotes(s) >= 2) {
    const inner = takeLine(
      s.slice(1),
      Math.max(1, limit - 1),
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation,
      options
    )
    if (inner.line) {
      const line = `"${inner.line}`
      const quoteInfo = analyzeDoubleQuoteSpan(line, false)
      const rest =
        inner.rest && quoteInfo.nextQuoteOpen && !inner.rest.startsWith('"')
          ? `"${inner.rest}`
          : inner.rest
      return normalizeSplit(line, rest)
    }
  }

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
        !/["']\s*$/.test(left) &&
        !/^["']/.test(right) &&
        shouldKeepShortSentencePairTogether(left, right)
      ) {
        return normalizeSplit(s.trimEnd(), '')
      }
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
          noSplitUsAbbreviation,
          { preserveLeadingThat: true }
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
  const splitDecision = findBestCut(window, s.slice(limit), noSplitAbbrevMatcher)
  const cut = adjustCutForTrailingQuote(window, splitDecision.cut)
  const preserveLeadingThat =
    splitDecision.reason === 'sentence' ||
    splitDecision.reason === 'strong' ||
    splitDecision.reason === 'semicolon' ||
    splitDecision.reason === 'comma'

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
    noSplitUsAbbreviation,
    { preserveLeadingThat }
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
  if (/\bto$/i.test(left)) return { line, rest }

  // Keep very short lead-ins intact (e.g. "Next, we review the").
  const leftWordCount = left
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean).length
  if (leftWordCount <= 3 && !startsWithAcronymPhrase(rest)) return { line, rest }

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

function normalizeTrailingHowToHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const match = trimmed.match(/^(.*)\s+(how)$/i)
  if (!match) return { line, rest }

  const left = (match[1] ?? '').trimEnd()
  if (!left) return { line, rest }
  if (!/^to\b/i.test(rest.trimStart())) return { line, rest }

  return { line: left, rest: `how ${rest.trimStart()}` }
}

function normalizeTrailingProtectedPhraseHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const trimmedRest = rest.trimStart()

  const eachOther = trimmed.match(/^(.*)\s+(each)$/i)
  if (eachOther && /^other\b/i.test(trimmedRest)) {
    const left = (eachOther[1] ?? "").trimEnd()
    const token = eachOther[2] ?? "each"
    if (left) return { line: left, rest: `${token} ${trimmedRest}` }
  }

  const oneAnother = trimmed.match(/^(.*)\s+(one)$/i)
  if (oneAnother && /^another\b/i.test(trimmedRest)) {
    const left = (oneAnother[1] ?? "").trimEnd()
    const token = oneAnother[2] ?? "one"
    if (left) return { line: left, rest: `${token} ${trimmedRest}` }
  }

  return { line, rest }
}

function normalizeTrailingPrepositionHead(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmed = line.trimEnd()
  const match = trimmed.match(/^(.*)\s+(of)$/i)
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

function normalizeLeadingCommaRest(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmedRest = rest.trimStart()
  if (!line || !trimmedRest.startsWith(",")) return { line, rest }

  const nextRest = trimmedRest.slice(1).trimStart()
  return { line: `${line.trimEnd()},`, rest: nextRest }
}

function normalizeTrailingHyphenCompound(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmedLine = line.trimEnd()
  const trimmedRest = rest.trimStart()
  if (!/[A-Za-z]-$/.test(trimmedLine) || !/^[A-Za-z][A-Za-z-]*/.test(trimmedRest)) {
    return { line, rest }
  }

  const token = trimmedRest.match(/^[A-Za-z][A-Za-z-]*/)?.[0]
  if (!token) return { line, rest }

  const nextRest = trimmedRest.slice(token.length).trimStart()
  return { line: `${trimmedLine}${token}`, rest: nextRest }
}

function normalizeTrailingCommaThat(
  line: string,
  rest: string
): { line: string; rest: string } {
  const trimmedLine = line.trimEnd()
  if (!/,\s+that$/i.test(trimmedLine) || !rest.trimStart()) return { line, rest }

  const nextLine = trimmedLine.replace(/\s+that$/i, '')
  return { line: nextLine, rest: `that ${rest.trimStart()}` }
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
  const subordinatorNormalized = normalizeTrailingSubordinatorHead(
    articleNormalized.line,
    articleNormalized.rest
  )
  const howToNormalized = normalizeTrailingHowToHead(
    subordinatorNormalized.line,
    subordinatorNormalized.rest
  )
  const protectedPhraseNormalized = normalizeTrailingProtectedPhraseHead(
    howToNormalized.line,
    howToNormalized.rest
  )
  const prepositionNormalized = normalizeTrailingPrepositionHead(
    protectedPhraseNormalized.line,
    protectedPhraseNormalized.rest
  )
  const hyphenNormalized = normalizeTrailingHyphenCompound(
    prepositionNormalized.line,
    prepositionNormalized.rest
  )
  const commaThatNormalized = normalizeTrailingCommaThat(
    hyphenNormalized.line,
    hyphenNormalized.rest
  )
  return normalizeLeadingCommaRest(
    commaThatNormalized.line,
    commaThatNormalized.rest
  )
}

function moveLeadingOfToPreviousLine(
  previousLine: string,
  currentLine: string
): { previousLine: string; currentLine: string } | null {
  const trimmedCurrent = currentLine.trimStart()
  const match = trimmedCurrent.match(/^(of)\b\s+(.+)$/i)
  if (!match) return null

  const word = match[1] ?? 'of'
  const rest = (match[2] ?? '').trim()
  if (!rest) return null

  return {
    previousLine: `${previousLine.trimEnd()} ${word}`,
    currentLine: rest,
  }
}

function normalizeLeadingOfTranslations(
  translations: Map<number, string>,
  orderedIndices: number[]
): void {
  for (let i = 1; i < orderedIndices.length; i += 1) {
    const previousIndex = orderedIndices[i - 1]
    const currentIndex = orderedIndices[i]
    const previousLine = translations.get(previousIndex)
    const currentLine = translations.get(currentIndex)
    if (!previousLine || !currentLine) continue

    const adjusted = moveLeadingOfToPreviousLine(previousLine, currentLine)
    if (!adjusted) continue

    translations.set(previousIndex, adjusted.previousLine)
    translations.set(currentIndex, adjusted.currentLine)
  }
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

  let nextLine = line.trimEnd()
  let nextRest = rest.trimStart()

  const usMatch = noSplitUsAbbreviation && /(?:^|\s)U\.$/i.test(nextLine)
  const sMatch = /^S\./i.test(nextRest)
  if (usMatch && sMatch) {
    const token = nextRest.match(/^S\./i)?.[0] ?? 'S.'
    nextLine = `${nextLine}${token}`
    nextRest = nextRest.slice(token.length).trimStart()
  }

  if (!isNoSplitAbbrevEnding(nextLine, noSplitAbbrevMatcher)) {
    return { line, rest }
  }
  if (!/^[A-Za-z]/.test(nextRest)) return { line: nextLine, rest: nextRest }
  if (endsWithMeridiemAbbrev(nextLine)) return { line: nextLine, rest: nextRest }

  const lastSpace = nextLine.lastIndexOf(' ')
  if (lastSpace > 0) {
    const rebalanceLine = nextLine.slice(0, lastSpace).trimEnd()
    const rebalanceRest = `${nextLine.slice(lastSpace).trimStart()} ${nextRest}`
    if (rebalanceLine) {
      return { line: rebalanceLine, rest: rebalanceRest.trimStart() }
    }
  }

  const wordMatch = nextRest.match(/^[^\s]+/)
  if (!wordMatch) return { line: nextLine, rest: nextRest }
  const word = wordMatch[0]
  const trailingRest = nextRest.slice(word.length).trimStart()
  return { line: `${nextLine} ${word}`, rest: trailingRest }
}

function mergeNoSplitPhrases(
  line: string,
  rest: string,
  options: { preserveLeadingThat?: boolean } = {}
): { line: string; rest: string } {
  if (!line || !rest) return { line, rest }

  const trimmedLine = line.trimEnd()
  const trimmedRest = rest.trimStart()
  const appendToken = (base: string, token: string) => {
    const noSpace = /(?:---|—|(?:^|\s)[A-Z]\.)$/.test(base)
    return noSpace ? `${base}${token}` : `${base} ${token}`
  }

  const endsWithSentence =
    /[.!?]["']?\s*$/.test(trimmedLine) || /[.!?]["']?\s*$/.test(line)

  if (endsWithPronounContraction(trimmedLine)) {
    const wordMatch = trimmedRest.match(/^[^\s]+/)
    if (wordMatch) {
      const token = wordMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }
  }

  if (/\b\d(?::\d{2})?$/i.test(trimmedLine)) {
    const meridiemMatch = trimmedRest.match(
      /^(?:a\.m\.(?:\s|$)|p\.m\.(?:\s|$)|am\b|pm\b)/i
    )
    if (meridiemMatch) {
      const token = meridiemMatch[0]
      const nextRest = trimmedRest.slice(token.length).trimStart()
      return { line: appendToken(trimmedLine, token), rest: nextRest }
    }
  }

  const thatMatch = trimmedRest.match(/^that(?:'s)?\b/i)
  if (
    thatMatch &&
    !options.preserveLeadingThat &&
    !endsWithSentence &&
    !endsWithClauseStarter(trimmedLine) &&
    !canSplitBeforeThat(trimmedLine) &&
    !shouldSplitBeforeThatClause(trimmedLine, trimmedRest)
  ) {
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
  noSplitUsAbbreviation: boolean,
  options: { preserveLeadingThat?: boolean } = {}
): { line: string; rest: string } {
  const phraseAdjusted = mergeNoSplitPhrases(line, rest, options)
  const abbrevAdjusted = adjustSplitForNoSplitAbbrev(
    phraseAdjusted.line,
    phraseAdjusted.rest,
    noSplitAbbrevMatcher,
    noSplitUsAbbreviation
  )
  return adjustSplitForQuotes(abbrevAdjusted.line, abbrevAdjusted.rest)
}

type QuoteMeta = {
  quoteCount: number
  isOpening: boolean
  isClosing: boolean
  isWrapped: boolean
  leadingQuoteIsContinuation: boolean
  nextQuoteOpen: boolean
}

function getQuoteMeta(rawLine: string, quoteOpen: boolean): QuoteMeta {
  const quoteInfo = analyzeDoubleQuoteSpan(rawLine, quoteOpen)
  return {
    quoteCount: quoteInfo.quoteCount,
    isOpening: quoteInfo.isOpeningAtStart,
    isClosing: quoteInfo.isClosingAtEnd,
    isWrapped: quoteInfo.hasLeadingQuote && quoteInfo.hasTrailingQuote,
    leadingQuoteIsContinuation: quoteInfo.leadingQuoteIsContinuation,
    nextQuoteOpen: quoteInfo.nextQuoteOpen,
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
  const shouldAddLeading = quoteOpen && !hasLeadingDoubleQuote(text)
  const shouldAddTrailing =
    !hasTrailingDoubleQuote(text) &&
    (meta.isWrapped ||
      (quoteOpen && meta.quoteCount === 0) ||
      (quoteOpen && meta.leadingQuoteIsContinuation && meta.quoteCount === 1) ||
      (meta.isOpening && meta.quoteCount === 1))

  if (shouldAddLeading) {
    text = `"${text}`
  }

  if (shouldAddTrailing) {
    text = `${text}"`
  }

  let nextQuoteOpen = quoteOpen
  if (meta.quoteCount > 0) {
    nextQuoteOpen = meta.nextQuoteOpen
  } else if (meta.isWrapped) {
    nextQuoteOpen = false
  } else if (meta.isOpening && isFirstInSpan) {
    nextQuoteOpen = true
  } else if (meta.isClosing && isLastInSpan) {
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
  noSplitUsAbbreviation: boolean,
  options: FillSubsOptions = {}
): FillRunResult {
  let remaining = normalizeParagraph(paragraph)
  if (!remaining) {
    return { lines: dryRun ? [] : [...lines], remaining: '', usedSlots: 0, overflow: false }
  }

  const outLines: string[] = []
  const translations = new Map<number, string>()
  let spanText: string | null = null
  let spanMeta: QuoteMeta | null = null
  let spanTotal = 0
  let spanIndex = 0
  let spanRemaining = 0
  let usedSlots = 0
  let overflow = false
  let quoteOpen = false
  let lastFilledIndex: number | null = null
  let lastTranslation: string | null = null

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
      translations.set(i, carried.text)
      lastTranslation = carried.text
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
    const availableSlots = countFillableSlotsFrom(lines, selectedLineIndices, i)
    const maxSpanCount =
      remaining && availableSlots > 1 ? availableSlots - 1 : availableSlots
    spanTotal = Math.max(1, Math.min(spanInfo.count, maxSpanCount))
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
    translations.set(i, carried.text)
    lastTranslation = carried.text
    lastFilledIndex = i
  }

  if (!dryRun && !remaining && lastTranslation && lastFilledIndex != null) {
    for (let i = lastFilledIndex + 1; i < lines.length; i += 1) {
      if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue
      if (translations.has(i)) continue
      translations.set(i, lastTranslation)
    }
  }

  if (!dryRun && options.altBreak) {
    const orderedIndices = [...translations.keys()].sort((a, b) => a - b)
    normalizeLeadingOfTranslations(translations, orderedIndices)
  }

  if (!dryRun) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      outLines.push(line)
      if (!isFillableTimestamp(lines, selectedLineIndices, i)) continue
      const translation = translations.get(i)
      if (translation) outLines.push(translation)
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

function countFillableSlotsFrom(
  lines: string[],
  selectedLineIndices: Set<number>,
  startIndex: number
): number {
  let count = 0
  for (let i = startIndex; i < lines.length; i += 1) {
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

  const candidates = new Set<number>([maxCps, minCps])
  for (let cps = minCps; cps <= maxCps; cps += 0.25) {
    candidates.add(Number(cps.toFixed(2)))
  }

  let best = maxCps
  let bestRemainingLength = Number.POSITIVE_INFINITY
  let bestSlots = -1

  for (const cps of [...candidates].sort((a, b) => b - a)) {
    const run = runInlineFill(
      lines,
      selectedLineIndices,
      paragraph,
      limit,
      cps,
      true,
      noSplitAbbrevMatcher,
      noSplitUsAbbreviation
    )
    if (run.overflow) continue

    const remainingLength = run.remaining.length
    if (remainingLength < bestRemainingLength) {
      bestRemainingLength = remainingLength
      bestSlots = run.usedSlots
      best = cps
      continue
    }
    if (remainingLength > bestRemainingLength) continue

    if (run.usedSlots > bestSlots) {
      bestSlots = run.usedSlots
      best = cps
      continue
    }
    if (run.usedSlots < bestSlots) continue

    if (remainingLength === 0 && run.usedSlots >= totalSlots && cps > best) {
      best = cps
      continue
    }
    if (cps < best) {
      best = cps
    }
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
  const noSplitAbbreviations =
    options.noSplitAbbreviations ?? DEFAULT_NO_SPLIT_ABBREVIATIONS
  const noSplitAbbrevMatcher = buildNoSplitAbbrevRe(noSplitAbbreviations)
  const noSplitUsAbbreviation = hasNoSplitUsAbbreviation(noSplitAbbreviations)

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
    noSplitUsAbbreviation,
    options
  )
  return { lines: run.lines, remaining: run.remaining, chosenCps: targetCps }
}
