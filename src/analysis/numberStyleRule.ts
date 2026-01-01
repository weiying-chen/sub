import type { Rule, NumberStyleMetric, RuleCtx } from './types'

import { type LineSource, parseBlockAt } from '../shared/tsvRuns'
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

const WORD_LIST = [
  ...Object.keys(SMALL),
  ...Object.keys(TENS),
  ...Object.keys(SCALES),
  'and',
].join('|')

const WORD_NUMBER_RE = new RegExp(
  `\\b(?:${WORD_LIST})(?:[\\s-]+(?:${WORD_LIST}))*\\b`,
  'gi'
)

function isSpace(ch: string) {
  return ch === ' ' || ch === '\t'
}

function isOpening(ch: string) {
  return ch === '"' || ch === "'" || ch === '(' || ch === '[' || ch === '{'
}

function isClosing(ch: string) {
  return ch === '"' || ch === "'" || ch === ')' || ch === ']' || ch === '}'
}

function isSentenceEnd(ch: string) {
  return ch === '.' || ch === '!' || ch === '?'
}

function isLineStart(text: string, index: number) {
  let i = 0
  while (i < index) {
    const ch = text[i]
    if (isSpace(ch) || isOpening(ch)) {
      i += 1
      continue
    }
    return false
  }
  return true
}

function isSentenceStart(text: string, index: number) {
  if (isLineStart(text, index)) return true

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

function parseNumberWords(words: string[]): number | null {
  let total = 0
  let current = 0
  let seen = false

  for (const raw of words) {
    const w = raw.toLowerCase()
    if (w === 'and') continue

    if (w in SMALL) {
      current += SMALL[w]
      seen = true
      continue
    }

    if (w in TENS) {
      current += TENS[w]
      seen = true
      continue
    }

    if (w === 'hundred') {
      if (current === 0) current = 1
      current *= 100
      seen = true
      continue
    }

    if (w in SCALES) {
      if (current === 0) current = 1
      total += current * SCALES[w]
      current = 0
      seen = true
      continue
    }

    return null
  }

  if (!seen) return null
  return total + current
}

type NumberStyleRule = Rule & SegmentRule

function getTextAndAnchor(
  ctx: RuleCtx | SegmentCtx
): { text: string; anchorIndex: number } | null {
  if ('segment' in ctx) {
    const text = ctx.segment.text
    if (text.trim() === '') return null
    return { text, anchorIndex: ctx.segment.lineIndex }
  }

  const src: LineSource = {
    lineCount: ctx.lines.length,
    getLine: (i) => ctx.lines[i] ?? '',
  }

  const block = parseBlockAt(src, ctx.lineIndex)
  if (!block) return null

  const text = block.payloadText
  if (text.trim() === '') return null

  const anchorIndex = block.payloadIndex ?? block.tsIndex
  return { text, anchorIndex }
}

function collectMetrics(
  text: string,
  anchorIndex: number,
  fullText?: string
): NumberStyleMetric[] {
  const metrics: NumberStyleMetric[] = []

  const digitsRe = /\b\d+\b/g
  let match: RegExpExecArray | null = null

  while ((match = digitsRe.exec(text))) {
    const value = Number.parseInt(match[0], 10)
    if (!Number.isFinite(value)) continue
    if (isTimeToken(text, match.index, match[0].length)) continue
    if (isAgeAdjective(text, match.index, match[0].length)) continue

    const sentenceStart = isSentenceStart(text, match.index)

    if (value <= 10 || sentenceStart) {
      metrics.push({
        type: 'NUMBER_STYLE',
        lineIndex: anchorIndex,
        index: match.index,
        value,
        found: 'digits',
        expected: 'words',
        token: match[0],
        text: fullText,
      })
    }
  }

  while ((match = WORD_NUMBER_RE.exec(text))) {
    const parts = match[0].split(/[\s-]+/).filter(Boolean)
    const value = parseNumberWords(parts)
    if (value == null || value <= 10) continue
    if (isAgeAdjective(text, match.index, match[0].length)) continue

    if (isSentenceStart(text, match.index)) continue

    metrics.push({
      type: 'NUMBER_STYLE',
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

export function numberStyleRule(): NumberStyleRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx && ctx.segment.candidateLines) {
      const candidates = ctx.segment.candidateLines
      if (candidates.length === 0) return []
      return candidates.flatMap((candidate) =>
        collectMetrics(candidate.text, candidate.lineIndex, candidate.text)
      )
    }

    const extracted = getTextAndAnchor(ctx)
    if (!extracted) return []

    return collectMetrics(extracted.text, extracted.anchorIndex, extracted.text)
  }) as NumberStyleRule
}
