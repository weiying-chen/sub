import { analyzeTextByType, type AnalysisType } from './analyzeTextByType'
import { capitalizationRule } from './capitalizationRule'
import { createSubsFindingsRules, createSubsMetricsRules } from './subsSegmentRules'
import { maxCharsRule } from './maxCharsRule'
import { numberStyleRule } from './numberStyleRule'
import type { Metric, Finding } from './types'
import { getFindings } from '../shared/findings'

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
  ignoreEmptyLines?: boolean
  includeWarnings?: boolean
}

function buildRules(options: BuildAnalysisOutputOptions) {
  const { type, ruleSet, enabledRuleTypes, capitalizationTerms, properNouns, ignoreEmptyLines } =
    options

  if (type === 'news') {
    const enabled = enabledRuleTypes ? new Set<Metric['type']>(enabledRuleTypes) : null
    const rules = []
    if (!enabled || enabled.has('MAX_CHARS')) rules.push(maxCharsRule(54))
    if (!enabled || enabled.has('NUMBER_STYLE')) rules.push(numberStyleRule())
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
