import { analyzeTextByType, type AnalysisType } from './analyzeTextByType'
import { capitalizationRule } from './capitalizationRule'
import { createSubsFindingsRules, createSubsMetricsRules } from './subsSegmentRules'
import { dashStyleRule } from './dashStyleRule'
import { quoteStyleRule } from './quoteStyleRule'
import { maxCharsRule } from './maxCharsRule'
import { missingTranslationRule } from './missingTranslationRule'
import { newsMarkerRule } from './newsMarkerRule'
import { numberStyleRule } from './numberStyleRule'
import { punctuationRule } from './punctuationRule'
import { repeatedWordRule } from './repeatedWordRule'
import { periodInCaptionRule } from './superFinalPeriodRule'
import { superPeopleRule } from './superPeopleRule'
import { termVariantRule, type TermVariantEntry } from './termVariantRule'
import type { SegmentCtx, SegmentRule } from './segments'
import type { Metric, Finding } from './types'
import { getFindings } from '../shared/findings'
import { filterSegments } from './segmentRuleFilters'
import { leadingWhitespaceRule } from './leadingWhitespaceRule'
import { percentStyleRule } from './percentStyleRule'
import { DEFAULT_MAX_CHARS, NEWS_MAX_CHARS } from '../shared/maxChars'

export type AnalysisRuleSet = 'findings' | 'metrics'
export type AnalysisOutputMode = 'metrics' | 'findings'

export type BuildAnalysisOutputOptions = {
  text: string
  type: AnalysisType
  ruleSet: AnalysisRuleSet
  output: AnalysisOutputMode
  enabledRuleTypes?: Metric['type'][]
  maxCps?: number
  minCps?: number
  capitalizationTerms?: string[]
  termVariants?: TermVariantEntry[]
  properNouns?: string[]
  abbreviations?: string[]
  baselineText?: string
  maxChars?: number
  ignoreEmptyLines?: boolean
  includeWarnings?: boolean
}

function newsSuperPunctuationRule(
  options: {
    properNouns?: string[]
    abbreviations?: string[]
    ignoreEmptyLines?: boolean
  } = {}
): SegmentRule {
  const baseRule = punctuationRule(options) as SegmentRule
  return (ctx: SegmentCtx) => {
    if (ctx.segmentIndex !== 0 || !ctx.lines) return []

    const targetLineIndices = new Set<number>()
    for (const segment of ctx.segments) {
      if (segment.blockType !== 'super') continue
      for (const line of segment.targetLines ?? []) {
        targetLineIndices.add(line.lineIndex)
      }
    }

    if (targetLineIndices.size === 0) return []

    const filteredLines = ctx.lines.map((line, i) =>
      targetLineIndices.has(i) ? line : ''
    )

    return baseRule({
      ...ctx,
      lines: filteredLines,
    })
  }
}

function buildRules(options: BuildAnalysisOutputOptions) {
  const {
    type,
    ruleSet,
    enabledRuleTypes,
    maxCps,
    minCps,
    capitalizationTerms,
    termVariants,
    properNouns,
    abbreviations,
    baselineText,
    maxChars,
    ignoreEmptyLines,
  } =
    options

  const punctuationStarts = [
    ...(properNouns ?? []),
    ...(capitalizationTerms ?? []),
  ]

  if (type === 'news') {
    const enabled = enabledRuleTypes ? new Set<Metric['type']>(enabledRuleTypes) : null
    const rules = []
    const maxCharsLimit = Math.max(1, maxChars ?? NEWS_MAX_CHARS)
    if (!enabled || enabled.has('MAX_CHARS')) {
      rules.push(filterSegments((segment) => segment.blockType === 'super', maxCharsRule(maxCharsLimit)))
    }
    if (!enabled || enabled.has('MISSING_TRANSLATION')) {
      rules.push(missingTranslationRule())
    }
    if (!enabled || enabled.has('NEWS_MARKER')) {
      rules.push(newsMarkerRule())
    }
    if (!enabled || enabled.has('PEOPLE')) {
      rules.push(superPeopleRule())
    }
    if (!enabled || enabled.has('NUMBER_STYLE')) rules.push(numberStyleRule())
    if (!enabled || enabled.has('DASH_STYLE')) rules.push(dashStyleRule())
    if (!enabled || enabled.has('QUOTE_STYLE')) rules.push(quoteStyleRule())
    if (!enabled || enabled.has('PERIOD_IN_CAPTION')) rules.push(periodInCaptionRule())
    if (!enabled || enabled.has('PUNCTUATION')) {
      rules.push(
        newsSuperPunctuationRule({
          properNouns: punctuationStarts,
          abbreviations,
          ignoreEmptyLines,
        })
      )
    }
    if (!enabled || enabled.has('CAPITALIZATION')) {
      rules.push(
        capitalizationRule({
          terms: capitalizationTerms,
        })
      )
    }
    if (!enabled || enabled.has('TERM_VARIANT')) {
      rules.push(termVariantRule({ variants: termVariants }))
    }
    if (!enabled || enabled.has('REPEATED_WORD')) rules.push(repeatedWordRule())
    return rules
  }

  if (type === 'text') {
    const enabled = enabledRuleTypes ? new Set<Metric['type']>(enabledRuleTypes) : null
    const rules = []
    const maxCharsLimit = Math.max(1, maxChars ?? DEFAULT_MAX_CHARS)

    if (!enabled || enabled.has('MAX_CHARS')) rules.push(maxCharsRule(maxCharsLimit))
    if (!enabled || enabled.has('LEADING_WHITESPACE')) rules.push(leadingWhitespaceRule())
    if (!enabled || enabled.has('NUMBER_STYLE')) rules.push(numberStyleRule())
    if (!enabled || enabled.has('PERCENT_STYLE')) rules.push(percentStyleRule())
    if (!enabled || enabled.has('DASH_STYLE')) rules.push(dashStyleRule())
    if (!enabled || enabled.has('QUOTE_STYLE')) rules.push(quoteStyleRule())
    if (!enabled || enabled.has('PUNCTUATION')) {
      rules.push(
        punctuationRule({
          properNouns: punctuationStarts,
          abbreviations,
          ignoreEmptyLines,
        })
      )
    }
    if (!enabled || enabled.has('CAPITALIZATION')) {
      rules.push(
        capitalizationRule({
          terms: capitalizationTerms,
        })
      )
    }
    if (!enabled || enabled.has('TERM_VARIANT')) {
      rules.push(termVariantRule({ variants: termVariants }))
    }
    if (!enabled || enabled.has('REPEATED_WORD')) rules.push(repeatedWordRule())

    return rules
  }

  const assembly = ruleSet === 'findings' ? createSubsFindingsRules : createSubsMetricsRules
  return assembly({
    capitalizationTerms,
    termVariants,
    properNouns,
    abbreviations,
    baselineText,
    maxChars,
    maxCps,
    minCps,
    ignoreEmptyLines,
    enabledFindingTypes: enabledRuleTypes,
  })
}

export function buildAnalysisOutput(
  options: BuildAnalysisOutputOptions
): Metric[] | Finding[] {
  const metrics = analyzeTextByType(options.text, options.type, buildRules(options), {
    parseOptions: {
      ignoreEmptyLines: options.ignoreEmptyLines,
    },
  })

  if (options.output === 'findings') {
    return getFindings(metrics, { includeWarnings: options.includeWarnings })
  }

  return metrics
}
