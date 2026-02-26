import type { Rule, PunctuationMetric, RuleCtx } from './types'

import { createDoubleQuoteSpanTracker } from '../shared/doubleQuoteSpan'
import { TSV_RE } from '../shared/subtitles'
import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import type { SegmentCtx, SegmentRule } from './segments'

const OPEN_QUOTE_RE = /^\s*(["'])/
const I_PRONOUN_RE = /^\s*I(\b|')/
const ACRONYM_RE =
  /^\s*(["'\(\[\{])?\s*(?:[A-Z]{2,}(?:'s\b|\b)|(?:[A-Z]\.){2,}[A-Z]?(?:'s\b)?)/
const SENT_BOUNDARY_RE = /(?:[.!?:]|…|—|–|---)(?:["'\)\]\}]+)?\s*$/
const TERMINAL_RE = /(?:\.{3}|[.!?:…]|—|–|---)(?:["'\)\]\}]+)?\s*$/

type Cue = {
  start: string
  end: string
  text: string
  lineIndex: number
  tsIndex: number
  payloadIndex: number
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
          : '(?=$|\\s|["\'\\)\\]\\}\\.,!?:;…—–-])'
      return new RegExp(
        `^\\s*(?:["'\\(\\[\\{]\\s*)?${escapeRegExp(noun)}${boundary}`
      )
    })
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

function startsWithOpenQuote(s: string): string | null {
  const m = s.match(OPEN_QUOTE_RE)
  return m ? m[1] : null
}

function startsWithIPronoun(s: string): boolean {
  return I_PRONOUN_RE.test(s)
}

function startsWithAcronym(s: string): boolean {
  return ACRONYM_RE.test(s)
}

function endsSentenceBoundary(s: string): boolean {
  return SENT_BOUNDARY_RE.test(s.trimEnd())
}

function endsTerminal(s: string): boolean {
  return TERMINAL_RE.test(s.trimEnd())
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
      text: block.payloadText.trim(),
      lineIndex: block.payloadIndex,
      tsIndex: block.tsIndex,
      payloadIndex: block.payloadIndex,
    })
  }

  return cues
}

function hasInterveningNonEmptyLine(
  src: LineSource,
  startIndex: number,
  endIndex: number
): boolean {
  for (let i = startIndex + 1; i < endIndex; i += 1) {
    if (src.getLine(i).trim() !== '') return true
  }
  return false
}

function cueTimestamp(cue: Cue): string {
  return `${cue.start} -> ${cue.end}`
}

function addRule4Metric(
  cue: Cue,
  metrics: PunctuationMetric[],
  reported: Set<string>
) {
  if (reported.has(cue.text)) return
  if (!cue.text.trim()) return
  if (!firstAlphaCase(cue.text)) return
  if (endsTerminal(cue.text)) return
  reported.add(cue.text)

  metrics.push({
    type: 'PUNCTUATION',
    lineIndex: cue.lineIndex,
    ruleCode: 'MISSING_END_PUNCTUATION',
    instruction:
      "End this line with terminal punctuation (., ?, !, :, …, —, or '...').",
    text: cue.text,
    timestamp: cueTimestamp(cue),
  })
}

type PunctuationRule = Rule & SegmentRule

function collectMetrics(
  lines: string[],
  properNounMatchers: RegExp[],
  abbreviationMatchers: RegExp[],
  options: ParseBlockOptions = {}
): PunctuationMetric[] {
  const src: LineSource = {
    lineCount: lines.length,
    getLine: (i) => lines[i] ?? '',
  }
  const cues = collectCues(src, options)
  const quoteTracker = createDoubleQuoteSpanTracker()
  const quoteStateByCue = cues.map((cue) => quoteTracker.inspect(cue.text))
  const metrics: PunctuationMetric[] = []

  const reportedRule5 = new Set<string>()
  for (const cue of cues) {
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
      instruction: 'Add a closing " to match the opening quote.',
      text: cue.text,
      timestamp: cueTimestamp(cue),
    })
  }

  const reportedRule6 = new Set<string>()
  for (const cue of cues) {
    if (reportedRule6.has(cue.text)) continue
    const unmatched = findUnmatchedDoubleQuote(cue.text)
    if (unmatched?.kind !== 'close') continue
    reportedRule6.add(cue.text)

    metrics.push({
      type: 'PUNCTUATION',
      lineIndex: cue.lineIndex,
      ruleCode: 'MISSING_OPENING_QUOTE',
      instruction: 'Remove the extra closing " or add a matching opening ".',
      text: cue.text,
      timestamp: cueTimestamp(cue),
    })
  }

  for (let j = 0; j < cues.length - 1; j += 1) {
    const prev = cues[j]
    const next = cues[j + 1]
    if (next.text === prev.text) continue
    if (hasInterveningNonEmptyLine(src, prev.payloadIndex, next.tsIndex)) {
      continue
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

    if (prevTrim.endsWith('.') && case1 === 'lower') {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: next.lineIndex,
        ruleCode: 'LOWERCASE_AFTER_PERIOD',
        instruction: 'Capitalize the start of this line.',
        text: next.text,
        timestamp: cueTimestamp(next),
        prevText: prev.text,
        prevTimestamp: cueTimestamp(prev),
      })
    }

    if (
      !endsSentenceBoundary(prevTrim) &&
      !nextQuoteStart &&
      !startsWithIPronoun(next.text) &&
      !startsWithAcronym(next.text) &&
      !startsWithProperNoun(next.text, abbreviationMatchers) &&
      !startsWithProperNoun(next.text, properNounMatchers) &&
      case1 === 'upper'
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleCode: 'MISSING_PUNCTUATION_BEFORE_CAPITAL',
        instruction:
          'End this line with sentence-ending punctuation, or lowercase the next line.',
        text: prev.text,
        timestamp: cueTimestamp(prev),
        nextText: next.text,
        nextTimestamp: cueTimestamp(next),
      })
    }

    if (
      nextQuoteStart &&
      !nextIsQuoteContinuation &&
      !prevTrim.endsWith(':') &&
      !endsSentenceBoundary(prevTrim) &&
      prevQuoteOpenIndex === null
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleCode: 'MISSING_COLON_BEFORE_QUOTE',
        instruction: "End this line with ':' before the next quoted line.",
        text: prev.text,
        timestamp: cueTimestamp(prev),
        nextText: next.text,
        nextTimestamp: cueTimestamp(next),
      })
    }
  }

  const reportedRule4 = new Set<string>()
  const last = cues.at(-1) ?? null
  if (last) addRule4Metric(last, metrics, reportedRule4)

  return metrics
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
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      if (ctx.segmentIndex !== 0) return []
      if (!ctx.lines) return []
      return collectMetrics(
        ctx.lines,
        properNounMatchers,
        abbreviationMatchers,
        options
      )
    }

    if (ctx.lineIndex !== 0) return []
    return collectMetrics(ctx.lines, properNounMatchers, abbreviationMatchers, options)
  }) as PunctuationRule
}
