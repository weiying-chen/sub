import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { capitalizationRule } from '../analysis/capitalizationRule'
import { defaultSegmentRules } from '../analysis/defaultRules'
import { maxCharsRule } from '../analysis/maxCharsRule'
import { numberStyleRule } from '../analysis/numberStyleRule'
import { punctuationRuleWithOptions } from '../analysis/punctuationRule'
import type { Metric, Finding } from '../analysis/types'
import { getFindings } from '../shared/findings'
import { loadCapitalizationTerms, loadProperNouns } from './properNouns'

export type MetricsOptions = {
  type: 'subs' | 'news'
  ruleFilters?: string[]
  findingsOnly?: boolean
}

async function buildRules(type: 'subs' | 'news') {
  const capitalizationTerms = await loadCapitalizationTerms()
  if (type === 'news') {
    return [
      maxCharsRule(54),
      numberStyleRule(),
      capitalizationRule({
        terms: capitalizationTerms ?? undefined,
      }),
    ]
  }

  const properNouns = await loadProperNouns()
  return [
    ...defaultSegmentRules({
      capitalizationTerms: capitalizationTerms ?? undefined,
    }),
    numberStyleRule(),
    punctuationRuleWithOptions({
      properNouns: properNouns ?? undefined,
    }),
  ]
}

export async function buildMetricsOutput(
  text: string,
  options: MetricsOptions
): Promise<Metric[] | Finding[]> {
  const rules = await buildRules(options.type)
  const metrics = analyzeTextByType(text, options.type, rules)
  const output = options.findingsOnly ? getFindings(metrics) : metrics
  const filters = options.ruleFilters ?? []

  if (filters.length === 0) {
    return output
  }

  return output.filter((metric) => filters.includes(metric.type))
}
