import type { Rule, PunctuationMetric, RuleCtx } from './types'

import { TSV_RE } from '../shared/subtitles'
import type { SegmentCtx, SegmentRule } from './segments'

const OPEN_QUOTE_RE = /^\s*(["'])/
const I_PRONOUN_RE = /^\s*I(\b|['’])/
const ACRONYM_RE =
  /^\s*(["'\(\[\{])?\s*(?:[A-Z]{2,}(?:['’]s\b|\b)|(?:[A-Z]\.){2,}[A-Z]?(?:['’]s\b)?)/
const SENT_BOUNDARY_RE = /[.!?:](?:["'\)\]\}]+)?\s*$/
const TERMINAL_RE = /(?:\.{3}|[.!?:…])(?:["'\)\]\}]+)?\s*$/

type Cue = {
  start: string
  end: string
  text: string
  lineIndex: number
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
  if (!open) return false
  const firstIndex = s.indexOf(open)
  if (firstIndex < 0) return false
  return s.indexOf(open, firstIndex + 1) < 0
}

function collectCues(lines: string[]): Cue[] {
  const cues: Cue[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }

    const m = line.match(TSV_RE)
    if (!m?.groups) {
      i += 1
      continue
    }

    const start = m.groups.start
    const end = m.groups.end
    i += 1

    while (i < lines.length) {
      const next = lines[i]
      if (next.trim() === '') {
        i += 1
        break
      }

      if (TSV_RE.test(next)) {
        break
      }

      cues.push({
        start,
        end,
        text: next.trim(),
        lineIndex: i,
      })
      i += 1
      break
    }
  }

  return cues
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
    ruleId: 4,
    detail: 'CURR lacks terminal punctuation.',
    text: cue.text,
    timestamp: cueTimestamp(cue),
  })
}

type PunctuationRule = Rule & SegmentRule

function collectMetrics(lines: string[]): PunctuationMetric[] {
  const cues = collectCues(lines)
  const metrics: PunctuationMetric[] = []

  const reportedRule5 = new Set<string>()
  for (const cue of cues) {
    if (reportedRule5.has(cue.text)) continue
    if (!hasUnclosedStartingQuote(cue.text)) continue
    reportedRule5.add(cue.text)

    metrics.push({
      type: 'PUNCTUATION',
      lineIndex: cue.lineIndex,
      ruleId: 5,
      detail:
        'CURR starts with an opening quote but does not close it on the same line.',
      text: cue.text,
      timestamp: cueTimestamp(cue),
    })
  }

  for (let j = 0; j < cues.length - 1; j += 1) {
    const prev = cues[j]
    const next = cues[j + 1]
    if (next.text === prev.text) continue

    const case1 = firstAlphaCase(next.text)
    if (!case1) continue

    const prevTrim = prev.text.trimEnd()

    if (prevTrim.endsWith('.') && case1 === 'lower') {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: next.lineIndex,
        ruleId: 1,
        detail: "CURR starts lowercase after PREV ends with '.'.",
        text: next.text,
        timestamp: cueTimestamp(next),
        prevText: prev.text,
        prevTimestamp: cueTimestamp(prev),
      })
    }

    if (
      !endsSentenceBoundary(prevTrim) &&
      !startsWithOpenQuote(next.text) &&
      !startsWithIPronoun(next.text) &&
      !startsWithAcronym(next.text) &&
      case1 === 'upper'
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleId: 2,
        detail:
          'CURR lacks sentence-ending punctuation and NEXT starts capital.',
        text: prev.text,
        timestamp: cueTimestamp(prev),
        nextText: next.text,
        nextTimestamp: cueTimestamp(next),
      })
    }

    if (
      startsWithOpenQuote(next.text) &&
      !prevTrim.endsWith(':') &&
      !endsSentenceBoundary(prevTrim)
    ) {
      metrics.push({
        type: 'PUNCTUATION',
        lineIndex: prev.lineIndex,
        ruleId: 3,
        detail: "CURR should end with ':' before a quoted NEXT.",
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

export function punctuationRule(): PunctuationRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      if (ctx.segmentIndex !== 0) return []
      if (!ctx.lines) return []
      return collectMetrics(ctx.lines)
    }

    if (ctx.lineIndex !== 0) return []
    return collectMetrics(ctx.lines)
  }) as PunctuationRule
}
