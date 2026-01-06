// src/analysis/types.ts

// ---- Rule context ----

export type RuleCtx = {
  line: string
  lineIndex: number
  lines: string[]
  getLine: (index: number) => string
}

export type Rule = (ctx: RuleCtx) => Metric[]

// ---- Metrics (ALL results, always returned by rules) ----

export type MaxCharsMetric = {
  type: 'MAX_CHARS'
  lineIndex: number
  text: string
  maxAllowed: number
  actual: number
}

export type CPSMetric = {
  type: 'CPS'
  lineIndex: number // timestamp line index
  text: string
  maxCps: number
  minCps: number
  cps: number
  durationFrames: number
  charCount: number
}

export type CPSBalanceMetric = {
  type: 'CPS_BALANCE'
  lineIndex: number // timestamp line index (faster run)
  cps: number
  neighborCps: number
  deltaCps: number
  text?: string
}

export type NumberStyleMetric = {
  type: 'NUMBER_STYLE'
  lineIndex: number
  index: number
  value: number
  found: 'digits' | 'words'
  expected: 'digits' | 'words'
  token: string
  text?: string
}

export type PunctuationMetric = {
  type: 'PUNCTUATION'
  lineIndex: number
  ruleCode: PunctuationRuleCode
  instruction: string
  text: string
  timestamp?: string
  prevText?: string
  prevTimestamp?: string
  nextText?: string
  nextTimestamp?: string
}

export type PunctuationRuleCode =
  | 'LOWERCASE_AFTER_PERIOD'
  | 'MISSING_PUNCTUATION_BEFORE_CAPITAL'
  | 'MISSING_COLON_BEFORE_QUOTE'
  | 'MISSING_END_PUNCTUATION'
  | 'MISSING_CLOSING_QUOTE'
  | 'MISSING_OPENING_QUOTE'
  | 'MISSING_OPENING_QUOTE_CONTINUATION'

export type BaselineMetric = {
  type: 'BASELINE'
  lineIndex: number
  message: string
  reason?: 'missing' | 'extra' | 'inlineText'
  timestamp?: string
  expected?: string
  actual?: string
  baselineLineIndex?: number
}

export type Metric =
  | MaxCharsMetric
  | CPSMetric
  | CPSBalanceMetric
  | NumberStyleMetric
  | PunctuationMetric
  | BaselineMetric

// ---- Findings (violations only; derived from metrics) ----
// For now, Finding is just "a Metric that failed its threshold".
// Same shape, different meaning.

export type Finding = Metric
