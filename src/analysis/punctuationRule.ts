import type { Rule, PunctuationMetric, RuleCtx } from './types'

import { createDoubleQuoteSpanTracker } from '../shared/doubleQuoteSpan'
import { TSV_RE } from '../shared/subtitles'
import { endsSentenceBoundary, startsWithOpenQuote } from './punctuationShared'
import {
  type LineSource,
  type ParseBlockOptions,
  isSubsCommentLine,
  parseBlockAt,
} from '../shared/tsvRuns'
import { parseText, type SegmentCtx, type SegmentRule } from './segments'

const I_PRONOUN_RE = /^\s*(?:["'\(\[\{]\s*)*I(\b|')/
const HYPHENATED_ROMANIZED_NAME_RE =
  /^\s*(?:["'\(\[\{]\s*)?(?:[A-Z][a-z]+\s+)?[A-Z][a-z]+(?:-[a-z]+)+(?:\b|(?=\s))/
const A_PREFIX_ROMANIZED_NAME_RE =
  /^\s*(?:["'\(\[\{]\s*)?A(?:h)?\s+[A-Z][a-z]+(?:\b|(?=\s|['"]))/
const ACRONYM_RE =
  /^\s*(["'\(\[\{])?\s*(?:[A-Z]{2,}(?:'s\b|s\b|\b)|(?:[A-Z]\.){2,}[A-Z]?(?:'s\b|s\b)?)/ 
const ACRONYM_END_RE =
  /(?:^|\s)(?:[A-Z]{2,}(?:'s\b|s\b|\b)|(?:[A-Z]\.){2,}[A-Z]?(?:'s\b|s\b)?)(?:["'\)\]\}]+)?\s*$/ 
const KINSHIP_TITLE_START_RE =
  /^\s*(?:["'\(\[\{]\s*)?(?:Grandma|Grandpa)(?:\b|(?=\s|['"]))/ 
const DASH_TERMINAL_RE = /(?:—|---)/
const CAPITALIZATION_BOUNDARY_RE = /(?:[.!?:]|…)(?:["'\)\]\}]+)?\s*$/
const TERMINAL_RE = new RegExp(
  `(?:\\.{3}|[.!?:…]|${DASH_TERMINAL_RE.source})(?:["'\\)\\]\\}]+)?\\s*$`
)

type Cue = {
  start?: string
  end?: string
  text: string
  lineIndex: number
  tsIndex: number
  translationIndex: number
}

type PunctuationRuleOptions = {
  properNouns?: string[]
  abbreviations?: string[]
  ignoreEmptyLines?: boolean
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildProperNounMatchers(properNouns: string[]): RegExp[] {
  return properNouns
    .map((noun) => noun.trim())
    .filter((noun) => noun !== '')
    .map((noun) => {
      const boundary =
        /[A-Za-z0-9_]$/.test(noun)
          ? '\\b'
          : '(?=$|\\s|["\'\\)\\]\\}\\.,!?:;…—-])'
      return new RegExp(
        `^\\s*(?:["'\\(\\[\\{]\\s*)?${escapeRegExp(noun)}${boundary}`
      )
    })
}

function buildAbbreviationEndMatchers(abbreviations: string[]): RegExp[] {
  return abbreviations
    .map((abbreviation) => abbreviation.trim())
    .filter((abbreviation) => abbreviation !== '')
    .map(
      (abbreviation) =>
        new RegExp(`(?:^|\\s)${escapeRegExp(abbreviation)}(?:["'\\)\\]\\}]+)?\\s*$`, 'i')
    )
}

function startsWithProperNoun(
  text: string,
  properNounMatchers: RegExp[]
): boolean {
  if (properNounMatchers.length === 0) return false
  return properNounMatchers.some((matcher) => matcher.test(text))
}

function firstAlphaCase(s: string): 'lower' | 'upper' | null {
  for (const ch of s.trimStart()) {
    if (/[A-Za-z]/.test(ch)) {
      return ch === ch.toLowerCase() ? 'lower' : 'upper'
    }
  }
  return null
}

function startsWithIPronoun(s: string): boolean {
  return I_PRONOUN_RE.test(s)
}

function startsWithHyphenatedRomanizedName(s: string): boolean {
  return HYPHENATED_ROMANIZED_NAME_RE.test(s)
}

function startsWithAPrefixRomanizedName(s: string): boolean {
  return A_PREFIX_ROMANIZED_NAME_RE.test(s)
}

function startsWithAcronym(s: string): boolean {
  return ACRONYM_RE.test(s)
}

function startsWithKinshipTitle(s: string): boolean {
  return KINSHIP_TITLE_START_RE.test(s)
}

function endsWithAcronym(s: string): boolean {
  return ACRONYM_END_RE.test(s.trimEnd())
}

function endsWithConfiguredAbbreviation(
  s: string,
  abbreviationEndMatchers: RegExp[]
): boolean {
  const trimmed = s.trimEnd()
  return abbreviationEndMatchers.some((matcher) => matcher.test(trimmed))
}

function endsCapitalizationBoundary(s: string): boolean {
  return CAPITALIZATION_BOUNDARY_RE.test(s.trimEnd())
}

function endsTerminal(s: string): boolean {
  return TERMINAL_RE.test(s.trimEnd())
}

function normalizeForTerminalCompare(s: string): string {
  const trimmed = s.trim()
  const withoutClosers = trimmed.replace(/["'\)\]\}]+\s*$/, '').trimEnd()
  const withoutTerminal = withoutClosers
    .replace(/(?:\.{3}|[.!?:…]|—|---)\s*$/, '')
    .trimEnd()
  return withoutTerminal.replace(/\s+/g, ' ')
}

function isSameTextWithAddedTerminal(prevText: string, nextText: string): boolean {
  if (endsTerminal(prevText) || !endsTerminal(nextText)) return false

  const left = normalizeForTerminalCompare(prevText)
  const right = normalizeForTerminalCompare(nextText)
  return left !== '' && left === right
}

function isStandaloneDoubleQuotedCue(s: string): boolean {
  const trimmed = s.trim()
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return false
  return trimmed.indexOf('"', 1) >= 0
}

function isSingleLineParentheticalCue(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed === '' || /[\r\n]/.test(trimmed)) return false
  const isAsciiParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')')
  const isFullWidthParenthetical =
    trimmed.startsWith('（') && trimmed.endsWith('）')
  return isAsciiParenthetical || isFullWidthParenthetical
}

function startsWithOpeningParenthesis(s: string): boolean {
  const trimmed = s.trim()
  return trimmed.startsWith('(') || trimmed.startsWith('（')
}

function endsWithClosingParenthesis(s: string): boolean {
  const trimmed = s.trim()
  return trimmed.endsWith(')') || trimmed.endsWith('）')
}

function hasBalancedParentheses(s: string): boolean {
  let asciiDepth = 0
  let fullWidthDepth = 0

  for (const ch of s) {
    if (ch === '(') {
      asciiDepth += 1
    } else if (ch === ')') {
      asciiDepth -= 1
      if (asciiDepth < 0) return false
    } else if (ch === '（') {
      fullWidthDepth += 1
    } else if (ch === '）') {
      fullWidthDepth -= 1
      if (fullWidthDepth < 0) return false
    }
  }

  return asciiDepth === 0 && fullWidthDepth === 0
}

function buildParentheticalCueExemptions(cues: Cue[]): Set<number> {
  const exempt = new Set<number>()

  for (let i = 0; i < cues.length; i += 1) {
    const text = cues[i]?.text ?? ''

    if (isSingleLineParentheticalCue(text)) {
      exempt.add(i)
      continue
    }

    if (!startsWithOpeningParenthesis(text)) continue
    if (endsWithClosingParenthesis(text)) continue

    let closeIndex: number | null = null
    for (let j = i + 1; j < cues.length; j += 1) {
      const nextText = cues[j]?.text ?? ''
      if (startsWithOpeningParenthesis(nextText)) break
      if (endsWithClosingParenthesis(nextText)) {
        closeIndex = j
        break
      }
    }

    if (closeIndex == null) continue
    for (let j = i; j <= closeIndex; j += 1) exempt.add(j)
    i = closeIndex
  }

  return exempt
}

function hasUnclosedStartingQuote(s: string): boolean {
  const open = startsWithOpenQuote(s)
  if (open !== "'") return false
  if (!open) return false
  const firstIndex = s.indexOf(open)
  if (firstIndex < 0) return false
  return s.indexOf(open, firstIndex + 1) < 0
}

function findMatchingOpeningDoubleQuoteForTrailingQuote(s: string): number | null {
  const trimmed = s.trimEnd()
  if (!trimmed.endsWith('"')) return null
  const endIndex = trimmed.length - 1
  const openIndex = trimmed.lastIndexOf('"', endIndex - 1)
  return openIndex >= 0 ? openIndex : null
}

type UnmatchedDoubleQuote = { kind: 'open' | 'close'; index: number }

function findUnmatchedDoubleQuote(s: string): UnmatchedDoubleQuote | null {
  const quoteIndices: number[] = []
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '"') quoteIndices.push(i)
  }

  if (quoteIndices.length === 0) return null
  if (quoteIndices.length % 2 === 0) return null

  const index = quoteIndices[quoteIndices.length - 1]
  const prev = index > 0 ? s[index - 1] : ''
  const next = index + 1 < s.length ? s[index + 1] : ''

  const isWord = (ch: string) => /[\p{L}\p{N}]/u.test(ch)
  const isSpace = (ch: string) => /\s/u.test(ch)
  const isPunct = (ch: string) => /[.,!?;:…\)\]\}]/.test(ch)

  if (next && isWord(next)) return { kind: 'open', index }
  if (!next) return { kind: 'close', index }
  if (prev && isWord(prev) && (isSpace(next) || isPunct(next))) {
    return { kind: 'close', index }
  }

  return { kind: 'open', index }
}

function collectCues(
  src: LineSource,
  options: ParseBlockOptions = {}
): Cue[] {
  const cues: Cue[] = []

  for (let i = 0; i < src.lineCount; i += 1) {
    const block = parseBlockAt(src, i, options)
    if (!block) continue
    const tsLine = src.getLine(block.tsIndex)
    const m = tsLine.match(TSV_RE)
    if (!m?.groups) continue

    cues.push({
      start: m.groups.start,
      end: m.groups.end,
      text: block.translation.trim(),
      lineIndex: block.translationIndex,
      tsIndex: block.tsIndex,
      translationIndex: block.translationIndex,
    })
  }

  return cues
}

function collectParenthesisLineMetrics(
  src: LineSource,
  options: ParseBlockOptions = {}
): PunctuationMetric[] {
  const metrics: PunctuationMetric[] = []
  const seen = new Set<number>()

  for (let i = 0; i < src.lineCount; i += 1) {
    const block = parseBlockAt(src, i, options)
    if (!block) continue
    const blockTranslation = block.translation.trim()
    if (
      startsWithOpeningParenthesis(blockTranslation) &&
      endsWithClosingParenthesis(blockTranslation) &&
      hasBalancedParentheses(blockTranslation)
    ) {
      continue
    }

    for (const [idx, lineIndex] of block.translationIndices.entries()) {
      if (seen.has(lineIndex)) continue
      seen.add(lineIndex)

      const text = block.translationLines[idx] ?? ''
      const trimmed = text.trim()
      if (!trimmed) continue
      if (hasBalancedParentheses(trimmed)) continue

      const startsOpen = startsWithOpeningParenthesis(trimmed)
      const endsClose = endsWithClosingParenthesis(trimmed)

      if (startsOpen && !endsClose) {
        metrics.push({
          type: 'PUNCTUATION',
          lineIndex,
          ruleCode: 'MISSING_CLOSING_PAREN',
          text,
        })
      } else if (!startsOpen && endsClose) {
        metrics.push({
          type: 'PUNCTUATION',
          lineIndex,
          ruleCode: 'MISSING_OPENING_PAREN',
          text,
        })
      }
    }
  }

  return metrics
}

function collectTextCues(lines: string[]): Cue[] {
  const segments = parseText(lines.join('\n'))
  return segments.map((segment) => ({
    text: segment.translation.trim(),
    lineIndex: segment.lineIndex,
    tsIndex: segment.lineIndex,
    translationIndex: segment.lineIndex,
  }))
}

function hasInterveningNonEmptyLine(
  src: LineSource,
  startIndex: number,
  endIndex: number
): boolean {
  for (let i = startIndex + 1; i < endIndex; i += 1) {
    const text = src.getLine(i)
    if (isSubsCommentLine(text)) continue
    if (text.trim() !== '') return true
  }
  return false
}

function cueTimestamp(cue: Cue): string {
  if (!cue.start || !cue.end) return ''
  return `${cue.start} -> ${cue.end}`
}

function addRule4Metric(
  cue: Cue,
  metrics: PunctuationMetric[],
  reported: Set<string>
) {
  if (reported.has(cue.text)) return
  if (!cue.text.trim()) return
  if (isSingleLineParentheticalCue(cue.text)) return
  if (!firstAlphaCase(cue.text)) return
  if (endsTerminal(cue.text)) return
  reported.add(cue.text)

  metrics.push({
    type: 'PUNCTUATION',
    lineIndex: cue.lineIndex,
    ruleCode: 'MISSING_END_PUNCTUATION',
    text: cue.text,
    timestamp: cueTimestamp(cue),
  })
}

type PunctuationRule = Rule & SegmentRule

function collectMetrics(
  lines: string[],
  properNounMatchers: RegExp[],
  abbreviationMatchers: RegExp[],
  abbreviationEndMatchers: RegExp[],
  options: ParseBlockOptions = {}
): PunctuationMetric[] {
  const src: LineSource = {
    lineCount: lines.length,
    getLine: (i) => lines[i] ?? '',
  }
  const parenthesisLineMetrics = collectParenthesisLineMetrics(src, options)
  const cuesFromTimestamps = collectCues(src, options)
  const usesTimestampCues = cuesFromTimestamps.length > 0
  const cues = cuesFromTimestamps.length > 0 ? cuesFromTimestamps : collectTextCues(lines)
  const quoteTracker = createDoubleQuoteSpanTracker()
  const quoteStateByCue = cues.map((cue) => quoteTracker.inspect(cue.text))
  const parentheticalCueExemptions = buildParentheticalCueExemptions(cues)
  const metrics: PunctuationMetric[] = []
  const reportedRule4 = new Set<string>()

  const reportedRule5 = new Set<string>()
  for (let i = 0; i < cues.length; i += 1) {
    if (parentheticalCueExemptions.has(i)) continue
    const cue = cues[i]
    if (reportedRule5.has(cue.text)) continue
    const unmatched = findUnmatchedDoubleQuote(cue.text)
    const hasUnclosedOpenDoubleQuote = unmatched?.kind === 'open'
    if (!hasUnclosedOpenDoubleQuote && !hasUnclosedStartingQuote(cue.text)) {
      continue
    }
    reportedRule5.add(cue.text)

    metrics.push({
      type: 'PUNCTUATION',
      lineIndex: cue.lineIndex,
      ruleCode: 'MISSING_CLOSING_QUOTE',
      text: cue.text,
      timestamp: cueTimestamp(cue) || undefined,
    })
  }

  const reportedRule6 = new Set<string>()
  for (let i = 0; i < cues.length; i += 1) {
    if (parentheticalCueExemptions.has(i)) continue
    const cue = cues[i]
    if (reportedRule6.has(cue.text)) continue
    const unmatched = findUnmatchedDoubleQuote(cue.text)
    if (unmatched?.kind !== 'close') continue
    reportedRule6.add(cue.text)

    metrics.push({
      type: 'PUNCTUATION',
      lineIndex: cue.lineIndex,
      ruleCode: 'MISSING_OPENING_QUOTE',
      text: cue.text,
      timestamp: cueTimestamp(cue) || undefined,
    })
  }

  for (let j = 0; j < cues.length - 1; j += 1) {
    const prev = cues[j]
    const next = cues[j + 1]
    const prevIsParentheticalExempt = parentheticalCueExemptions.has(j)
    const nextIsParentheticalExempt = parentheticalCueExemptions.has(j + 1)

    if (isSameTextWithAddedTerminal(prev.text, next.text)) {
      addRule4Metric(prev, metrics, reportedRule4)
      continue
    }

    if (next.text === prev.text) continue
    const hasMetadataBreak = hasInterveningNonEmptyLine(
      src,
      prev.translationIndex,
      next.tsIndex
    )

    if (hasMetadataBreak) {
      if (!usesTimestampCues) {
        const nextCase = firstAlphaCase(next.text)
        if (nextCase === 'lower' && !prevIsParentheticalExempt) {
          addRule4Metric(prev, metrics, reportedRule4)
          continue
        }
      }

      if (!prevIsParentheticalExempt) {
        addRule4Metric(prev, metrics, reportedRule4)
      }
      if (usesTimestampCues) continue
    }

    const case1 = firstAlphaCase(next.text)
    if (!case1) continue

    const prevTrim = prev.text.trimEnd()
    const prevQuoteOpenIndex =
      findMatchingOpeningDoubleQuoteForTrailingQuote(prevTrim)
    const nextQuoteStart = startsWithOpenQuote(next.text)
    const nextIsQuoteContinuation =
      nextQuoteStart === '"' &&
      (quoteStateByCue[j + 1]?.leadingQuoteIsContinuation ?? false)
    const allowCapitalCheckWithQuotedNext =
      nextQuoteStart === '"' &&
      !nextIsQuoteContinuation &&
      isStandaloneDoubleQuotedCue(prev.text) &&
      isStandaloneDoubleQuotedCue(next.text)

    if (
      !prevIsParentheticalExempt &&
      !nextIsParentheticalExempt &&
      prevTrim.endsWith('.') &&
      case1 === 'lower' &&
      !endsWithAcronym(prevTrim) &&
      !endsWithConfiguredAbbreviation(prevTrim, abbreviationEndMatchers)
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: next.lineIndex,
        ruleCode: 'LOWERCASE_AFTER_PERIOD',
        text: next.text,
        timestamp: cueTimestamp(next) || undefined,
        prevText: prev.text,
        prevTimestamp: cueTimestamp(prev) || undefined,
      })
    }

    if (
      !prevIsParentheticalExempt &&
      !endsCapitalizationBoundary(prevTrim) &&
      (!nextQuoteStart || allowCapitalCheckWithQuotedNext) &&
      !startsWithIPronoun(next.text) &&
      !startsWithHyphenatedRomanizedName(next.text) &&
      !startsWithAPrefixRomanizedName(next.text) &&
      !startsWithAcronym(next.text) &&
      !startsWithKinshipTitle(next.text) &&
      !startsWithProperNoun(next.text, abbreviationMatchers) &&
      !startsWithProperNoun(next.text, properNounMatchers) &&
      case1 === 'upper'
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleCode: 'MISSING_PUNCTUATION_BEFORE_CAPITAL',
        text: prev.text,
        timestamp: cueTimestamp(prev) || undefined,
        nextText: next.text,
        nextTimestamp: cueTimestamp(next) || undefined,
      })
    }

    if (
      !prevIsParentheticalExempt &&
      !nextIsParentheticalExempt &&
      nextQuoteStart &&
      !nextIsQuoteContinuation &&
      prevTrim.endsWith(',') &&
      !prevTrim.endsWith(':') &&
      !endsSentenceBoundary(prevTrim) &&
      prevQuoteOpenIndex === null
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleCode: 'COMMA_BEFORE_QUOTE',
        text: prev.text,
        timestamp: cueTimestamp(prev) || undefined,
        nextText: next.text,
        nextTimestamp: cueTimestamp(next) || undefined,
      })
    }
  }

  const last = cues.at(-1) ?? null
  if (last && !parentheticalCueExemptions.has(cues.length - 1)) {
    addRule4Metric(last, metrics, reportedRule4)
  }

  return [...parenthesisLineMetrics, ...metrics]
}

export function punctuationRule(
  options: PunctuationRuleOptions = {}
): PunctuationRule {
  const properNounMatchers = buildProperNounMatchers(
    options.properNouns ?? []
  )
  const abbreviationMatchers = buildProperNounMatchers(
    options.abbreviations ?? []
  )
  const abbreviationEndMatchers = buildAbbreviationEndMatchers(
    options.abbreviations ?? []
  )
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      if (ctx.segmentIndex !== 0) return []
      if (!ctx.lines) return []
      return collectMetrics(
        ctx.lines,
        properNounMatchers,
        abbreviationMatchers,
        abbreviationEndMatchers,
        options
      )
    }

    if (ctx.lineIndex !== 0) return []
    return collectMetrics(
      ctx.lines,
      properNounMatchers,
      abbreviationMatchers,
      abbreviationEndMatchers,
      options
    )
  }) as PunctuationRule
}
