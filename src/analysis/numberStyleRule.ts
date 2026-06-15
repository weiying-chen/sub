import type { Rule, NumberStyleMetric, RuleCtx } from './types'

import {
  type LineSource,
  type ParseBlockOptions,
  parseBlockAt,
} from '../shared/tsvRuns'
import { createDoubleQuoteSpanTracker } from '../shared/doubleQuoteSpan'
import type { SegmentCtx, SegmentRule } from './segments'

const SMALL: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1000000,
  billion: 1000000000,
  trillion: 1000000000000,
}

const DECADE_WORDS: Record<string, number> = {
  twenties: 20,
  thirties: 30,
  forties: 40,
  fifties: 50,
  sixties: 60,
  seventies: 70,
  eighties: 80,
  nineties: 90,
}

const WORD_LIST = [
  ...Object.keys(SMALL),
  ...Object.keys(TENS),
  ...Object.keys(SCALES),
  'and',
].join('|')

const DECADE_WORD_RE = new RegExp(`\\b(?:${Object.keys(DECADE_WORDS).join('|')})\\b`, 'gi')
const DIGIT_TOKEN_RE_SOURCE = '\\b\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?\\b|\\b\\d+(?:\\.\\d+)?\\b'
const NUMBER_TOKEN_RE_SOURCE =
  `(?:${DIGIT_TOKEN_RE_SOURCE}|(?:${WORD_LIST})(?:[\\s-]+(?:${WORD_LIST}))*)`
const COORDINATED_NUMBER_LIST_RE = new RegExp(
  `\\b${NUMBER_TOKEN_RE_SOURCE}(?:\\s*,\\s*${NUMBER_TOKEN_RE_SOURCE})*(?:\\s*,?\\s+(?:and|or)\\s+${NUMBER_TOKEN_RE_SOURCE})\\s+[A-Za-z]+\\b`,
  'gi'
)

function isSpace(ch: string) {
  return ch === ' ' || ch === '\t'
}

function isQuote(ch: string) {
  return ch === '"' || ch === "'"
}

function isOpening(ch: string) {
  return ch === '(' || ch === '[' || ch === '{'
}

function isClosing(ch: string) {
  return ch === '"' || ch === "'" || ch === ')' || ch === ']' || ch === '}'
}

function isSentenceEnd(ch: string) {
  return ch === '.' || ch === '!' || ch === '?'
}

function isLineStart(text: string, index: number, allowLeadingDoubleQuote = true) {
  let i = 0
  let sawLeadingQuote = false
  while (i < index) {
    const ch = text[i]
    if (isSpace(ch) || isOpening(ch)) {
      i += 1
      continue
    }
    if (isQuote(ch)) {
      if (ch === '"' && !allowLeadingDoubleQuote) return false
      if (sawLeadingQuote) return false
      sawLeadingQuote = true
      i += 1
      continue
    }
    return false
  }
  return true
}

function isSentenceStart(
  text: string,
  index: number,
  allowLeadingDoubleQuote = true
) {
  if (isLineStart(text, index, allowLeadingDoubleQuote)) return true

  let i = index - 1
  while (i >= 0 && isSpace(text[i])) i -= 1
  while (i >= 0 && isClosing(text[i])) i -= 1
  return i >= 0 && isSentenceEnd(text[i])
}

function isTimeToken(text: string, index: number, length: number) {
  const before = index - 1 >= 0 ? text[index - 1] : ''
  const after = index + length < text.length ? text[index + length] : ''
  return before === ':' || after === ':'
}

function isAgeAdjective(text: string, index: number, length: number) {
  const tail = text.slice(index + length).toLowerCase()
  return /^(?:\s*-|\s+)year(?:-|\s+)old\b/.test(tail)
}

function isPercentToken(text: string, index: number, length: number) {
  const tail = text.slice(index + length)
  return /^\s*(%|percent\b)/i.test(tail)
}

function isAmPmToken(text: string, index: number, length: number) {
  const tail = text.slice(index + length)
  return /^\s*(?:a\.m\.(?!\w)|p\.m\.(?!\w)|am\b|pm\b)/i.test(tail)
}

function isTemperatureUnitToken(text: string, index: number, length: number) {
  const tail = text.slice(index + length)
  return /^\s*(?:°\s*[cf]\b|degrees?\s+(?:celsius|fahrenheit)\b|celsius\b|fahrenheit\b)/i.test(
    tail
  )
}

function isMeasurementUnitToken(text: string, index: number, length: number) {
  const tail = text.slice(index + length)
  return /^\s*(?:kg|g|mg|lb|lbs|oz|mm|cm|m(?!illion\b)|km|meter(?:s)?|metre(?:s)?|centimeter(?:s)?|centimetre(?:s)?|millimeter(?:s)?|millimetre(?:s)?|kilometer(?:s)?|kilometre(?:s)?|inch(?:es)?|ft|foot|feet|yard(?:s)?|mile(?:s)?)\b/i.test(
    tail
  )
}

function isCurrencyToken(text: string, index: number) {
  const prefix = text.slice(0, index)
  const window = prefix.slice(Math.max(0, prefix.length - 12))
  if (
    /\b(?:NT|US|HK|SG|AUD|CAD|USD|HKD|TWD|JPY|RMB|CNY|EUR|GBP)\s*\$\s*$/i.test(
      window
    )
  ) {
    return true
  }
  return /\$\s*$/.test(window)
}

function isLevelNumberToken(text: string, index: number) {
  const prefix = text.slice(0, index)
  return /\blevel\s+$/i.test(prefix)
}

function isDigitRangeToken(text: string, index: number, length: number) {
  const prefix = text.slice(0, index)
  const suffix = text.slice(index + length)
  return (
    /\b\d+\s*(?:to|[-–—])\s*$/i.test(prefix) ||
    /^\s*(?:to|[-–—])\s*\d+\b/i.test(suffix)
  )
}

function isStatisticalRatioToken(text: string, index: number, length: number) {
  const prefix = text.slice(0, index)
  const suffix = text.slice(index + length)
  return /\bin(?:\s+a)?\s+$/i.test(prefix) || /^\s+in\b/i.test(suffix)
}

function getCoordinatedNumberListSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = []
  let match: RegExpExecArray | null = null

  while ((match = COORDINATED_NUMBER_LIST_RE.exec(text))) {
    spans.push({ start: match.index, end: match.index + match[0].length })
  }

  return spans
}

function isWithinAnySpan(
  spans: Array<{ start: number; end: number }>,
  index: number,
  length: number
) {
  const end = index + length
  return spans.some((span) => index >= span.start && end <= span.end)
}

type NumberStyleRule = Rule & SegmentRule

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx,
  options: ParseBlockOptions = {}
): { text: string; anchorIndex: number } | null {
  if ('segment' in ctx) {
    const text = ctx.segment.translation
    if (text.trim() === '') return null
    return { text, anchorIndex: ctx.segment.lineIndex }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? '',
  }

  const block = parseBlockAt(src, ctx.lineIndex, options)
  if (!block) return null

  const text = block.translation
  if (text.trim() === '') return null

  const anchorIndex = block.translationIndex ?? block.tsIndex
  return { text, anchorIndex }
}

function collectMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string,
  allowLeadingDoubleQuote = true
): NumberStyleMetric[] {
  const metrics: NumberStyleMetric[] = []
  const coordinatedListSpans = getCoordinatedNumberListSpans(text)

  const digitsRe = new RegExp(DIGIT_TOKEN_RE_SOURCE, 'g')
  let match: RegExpExecArray | null = null

  while ((match = digitsRe.exec(text))) {
    const rawToken = match[0]
    if (rawToken.includes('.')) continue
    const normalized = rawToken.replace(/,/g, '')
    const value = Number.parseInt(normalized, 10)
    if (!Number.isFinite(value)) continue
    if (isTimeToken(text, match.index, rawToken.length)) continue
    if (isAmPmToken(text, match.index, rawToken.length)) continue
    if (isAgeAdjective(text, match.index, rawToken.length)) continue
    if (isDigitRangeToken(text, match.index, rawToken.length)) continue
    if (isWithinAnySpan(coordinatedListSpans, match.index, rawToken.length)) continue
    if (isStatisticalRatioToken(text, match.index, rawToken.length)) continue
    if (isPercentToken(text, match.index, rawToken.length)) continue
    if (isTemperatureUnitToken(text, match.index, rawToken.length)) continue
    if (isMeasurementUnitToken(text, match.index, rawToken.length)) continue
    if (isCurrencyToken(text, match.index)) continue
    if (isLevelNumberToken(text, match.index)) continue

    const sentenceStart = isSentenceStart(
      text,
      match.index,
      allowLeadingDoubleQuote
    )

    if (value <= 10 || sentenceStart) {
      metrics.push({
        type: 'NUMBER_STYLE',
        ruleCode: 'SMALL_NUMBER_AS_DIGITS',
        lineIndex: anchorIndex,
        index: match.index,
        value,
        found: 'digits',
        expected: 'words',
        token: rawToken,
        text: fullText,
      })
    }
  }

  while ((match = DECADE_WORD_RE.exec(text))) {
    const decadeWord = match[0].toLowerCase()
    const value = DECADE_WORDS[decadeWord]
    if (value == null) continue

    metrics.push({
      type: 'NUMBER_STYLE',
      ruleCode: 'DECADE_WORD_AS_TEXT',
      lineIndex: anchorIndex,
      index: match.index,
      value,
      found: 'words',
      expected: 'digits',
      token: match[0],
      text: fullText,
    })
  }

  return metrics
}

export function numberStyleRule(
  options: ParseBlockOptions = {}
): NumberStyleRule {
  const quoteTracker = createDoubleQuoteSpanTracker()

  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.targetLines) {
      const candidates = ctx.segment.targetLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) => {
        const quoteInfo = quoteTracker.inspect(candidate.lineText)
        return collectMetrics(
          candidate.lineText,
          candidate.lineIndex,
          candidate.lineText,
          !quoteInfo.leadingQuoteIsContinuation
        )
      })
    }

    const extracted = getTextAndAnchor(ctx, options)
    if (!extracted) return []

    const quoteInfo = quoteTracker.inspect(extracted.text)
    return collectMetrics(
      extracted.text,
      extracted.anchorIndex,
      extracted.text,
      !quoteInfo.leadingQuoteIsContinuation
    )
  }) as NumberStyleRule
}
