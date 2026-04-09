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
  severity?: 'error' | 'warn'
}

export type LeadingWhitespaceMetric = {
  type: 'LEADING_WHITESPACE'
  lineIndex: number
  index: number
  count: number
  text?: string
  severity?: 'error' | 'warn'
}

type CpsBaseMetric = {
  lineIndex: number // translation line index
  tsLineIndex?: number // timestamp line index
  text: string
  cps: number
  durationFrames: number
  charCount: number
}

export type CPSMetric = CpsBaseMetric & {
  type: 'CPS'
  maxCps: number
  minCps: number
}

export type MaxCpsMetric = CpsBaseMetric & {
  type: 'MAX_CPS'
  maxCps: number
  severity: 'error' | 'warn'
}

export type MinCpsMetric = CpsBaseMetric & {
  type: 'MIN_CPS'
  minCps: number
  severity: 'error' | 'warn'
}

export type CPSBalanceMetric = {
  type: 'CPS_BALANCE'
  lineIndex: number // translation line index (faster run)
  tsLineIndex?: number // timestamp line index (faster run)
  cps: number
  neighborCps: number
  deltaCps: number
  text?: string
  severity?: 'error' | 'warn'
}

export type NumberStyleMetric = {
  type: 'NUMBER_STYLE'
  ruleCode: NumberStyleRuleCode
  lineIndex: number
  index: number
  value: number
  found: 'digits' | 'words'
  expected: 'digits' | 'words'
  token: string
  text?: string
  severity?: 'error' | 'warn'
}

export type NumberStyleRuleCode =
  | 'SMALL_NUMBER_AS_DIGITS'
  | 'LARGE_NUMBER_AS_WORDS'
  | 'DECADE_WORD_AS_TEXT'

export type PercentStyleMetric = {
  type: 'PERCENT_STYLE'
  lineIndex: number
  index: number
  value: number
  found: 'word'
  expected: 'symbol'
  token: string
  text?: string
  severity?: 'error' | 'warn'
}

export type CapitalizationMetric = {
  type: 'CAPITALIZATION'
  lineIndex: number
  index: number
  found: string
  expected: string
  token: string
  text?: string
  severity?: 'error' | 'warn'
}

export type DashStyleMetric = {
  type: 'DASH_STYLE'
  lineIndex: number
  index: number
  token: string
  text: string
  expected: 'em_dash' | 'triple_hyphen'
  found: 'em_dash' | 'en_dash' | 'triple_hyphen'
  blockType: 'subs' | 'vo' | 'super'
  severity?: 'error' | 'warn'
}

export type PunctuationMetric = {
  type: 'PUNCTUATION'
  lineIndex: number
  ruleCode: PunctuationRuleCode
  instruction?: string
  text: string
  timestamp?: string
  prevText?: string
  prevTimestamp?: string
  nextText?: string
  nextTimestamp?: string
  severity?: 'error' | 'warn'
}

export type PunctuationRuleCode =
  | 'LOWERCASE_AFTER_PERIOD'
  | 'MISSING_PUNCTUATION_BEFORE_CAPITAL'
  | 'COMMA_BEFORE_QUOTE'
  | 'MISSING_END_PUNCTUATION'
  | 'MISSING_CLOSING_QUOTE'
  | 'MISSING_OPENING_QUOTE'

export type BlockStructureMetric = {
  type: 'BLOCK_STRUCTURE'
  lineIndex: number
  ruleCode: BlockStructureRuleCode
  text: string
  severity?: 'error' | 'warn'
}

export type BlockStructureRuleCode = 'MISSING_TRANSLATION'

export type TimestampFormatMetric = {
  type: 'TIMESTAMP_FORMAT'
  lineIndex: number
  text: string
  severity?: 'error' | 'warn'
}

export type BaselineMetric = {
  type: 'BASELINE'
  ruleCode: BaselineRuleCode
  lineIndex: number
  message?: string
  reason?: 'missing' | 'extra' | 'sourceText'
  timestamp?: string
  expected?: string
  actual?: string
  baselineLineIndex?: number
  severity?: 'error' | 'warn'
}

export type BaselineRuleCode =
  | 'MISSING_TIMESTAMP_LINE'
  | 'EXTRA_TIMESTAMP_LINE'
  | 'SOURCE_TEXT_MISMATCH'

export type MergeCandidateMetric = {
  type: 'MERGE_CANDIDATE'
  lineIndex: number
  nextLineIndex: number
  instruction?: string
  text: string
  nextText: string
  gapFrames: number
  editDistance: number
  severity?: 'error' | 'warn'
}

export type JoinableBreakMetric = {
  type: 'JOINABLE_BREAK'
  lineIndex: number
  nextLineIndex: number
  text: string
  nextText: string
  gapFrames: number
  joinedLength: number
  maxJoinedChars: number
  severity?: 'error' | 'warn'
}

export type SpanGapMetric = {
  type: 'SPAN_GAP'
  lineIndex: number
  nextLineIndex: number
  instruction?: string
  text: string
  nextText: string
  gapFrames: number
  severity?: 'error' | 'warn'
}

export type MissingTranslationMetric = {
  type: 'MISSING_TRANSLATION'
  lineIndex: number
  blockType: 'vo' | 'super'
  text: string
  sourceLineIndex?: number
  severity?: 'error' | 'warn'
}

export type SuperPeopleMetric = {
  type: 'SUPER_PEOPLE'
  lineIndex: number
  ruleCode: import('./superPeopleRule').SuperPeopleRuleCode
  text: string
  severity?: 'error' | 'warn'
}

export type Metric =
  | MaxCharsMetric
  | LeadingWhitespaceMetric
  | CPSMetric
  | MaxCpsMetric
  | MinCpsMetric
  | CPSBalanceMetric
  | NumberStyleMetric
  | PercentStyleMetric
  | CapitalizationMetric
  | DashStyleMetric
  | PunctuationMetric
  | TimestampFormatMetric
  | BlockStructureMetric
  | MergeCandidateMetric
  | JoinableBreakMetric
  | SpanGapMetric
  | MissingTranslationMetric
  | SuperPeopleMetric
  | import('./newsMarkerRule').NewsMarkerMetric
  | BaselineMetric

// ---- Findings (violations only; derived from metrics) ----
// For now, Finding is just "a Metric that failed its threshold".
// Same shape, different meaning.

export type Finding = Metric & { instruction?: string }
