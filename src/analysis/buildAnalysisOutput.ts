import { analyzeTextByType, type AnalysisType } from './analyzeTextByType'
import { capitalizationRule } from './capitalizationRule'
import { createSubsFindingsRules, createSubsMetricsRules } from './subsSegmentRules'
import { dashStyleRule } from './dashStyleRule'
import { maxCharsRule } from './maxCharsRule'
import { missingTranslationRule } from './missingTranslationRule'
import { newsMarkerRule } from './newsMarkerRule'
import { numberStyleRule } from './numberStyleRule'
import { superPeopleRule } from './superPeopleRule'
import type { Metric, Finding } from './types'
import { getFindings } from '../shared/findings'
import { filterSegments } from './segmentRuleFilters'

export type AnalysisRuleSet = 'findings' | 'metrics'
export type AnalysisOutputMode = 'metrics' | 'findings'

export type BuildAnalysisOutputOptions = {
  text: string
  type: AnalysisType
  ruleSet: AnalysisRuleSet
  output: AnalysisOutputMode
  enabledRuleTypes?: Metric['type'][]
  capitalizationTerms?: string[]
  properNouns?: string[]
  abbreviations?: string[]
  baselineText?: string
  ignoreEmptyLines?: boolean
  includeWarnings?: boolean
}

function buildRules(options: BuildAnalysisOutputOptions) {
  const {
    type,
    ruleSet,
    enabledRuleTypes,
    capitalizationTerms,
    properNouns,
    abbreviations,
    baselineText,
    ignoreEmptyLines,
  } =
    options

  if (type === 'news') {
    const enabled = enabledRuleTypes ? new Set<Metric['type']>(enabledRuleTypes) : null
    const rules = []
    if (!enabled || enabled.has('MAX_CHARS')) {
      rules.push(filterSegments((segment) => segment.blockType === 'super', maxCharsRule(54)))
    }
    if (!enabled || enabled.has('MISSING_TRANSLATION')) {
      rules.push(missingTranslationRule())
    }
    if (!enabled || enabled.has('NEWS_MARKER')) {
      rules.push(newsMarkerRule())
    }
    if (!enabled || enabled.has('SUPER_PEOPLE')) {
      rules.push(superPeopleRule())
    }
    if (!enabled || enabled.has('NUMBER_STYLE')) rules.push(numberStyleRule())
    if (!enabled || enabled.has('DASH_STYLE')) rules.push(dashStyleRule())
    if (!enabled || enabled.has('CAPITALIZATION')) {
      rules.push(
        capitalizationRule({
          terms: capitalizationTerms,
        })
      )
    }
    return rules
  }

  const assembly = ruleSet === 'findings' ? createSubsFindingsRules : createSubsMetricsRules
  return assembly({
    capitalizationTerms,
    properNouns,
    abbreviations,
    baselineText,
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
