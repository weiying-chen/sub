import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { capitalizationRule } from '../analysis/capitalizationRule'
import { createSubsSegmentRules } from '../analysis/subsSegmentRules'
import { maxCharsRule } from '../analysis/maxCharsRule'
import { numberStyleRule } from '../analysis/numberStyleRule'
import type { Metric, Finding } from '../analysis/types'
import { getFindings } from '../shared/findings'
import { loadCapitalizationTerms, loadProperNouns } from './properNouns'

export type MetricsOptions = {
  type: 'subs' | 'news'
  ruleFilters?: string[]
  findingsOnly?: boolean
  ignoreEmptyLines?: boolean
}

async function buildRules(
  type: 'subs' | 'news',
  ignoreEmptyLines?: boolean
) {
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
  return createSubsSegmentRules({
    capitalizationTerms: capitalizationTerms ?? undefined,
    properNouns: properNouns ?? undefined,
    ignoreEmptyLines,
  })
}

export async function buildMetricsOutput(
  text: string,
  options: MetricsOptions
): Promise<Metric[] | Finding[]> {
  const rules = await buildRules(options.type, options.ignoreEmptyLines)
  const metrics = analyzeTextByType(text, options.type, rules, {
    parseOptions: {
      ignoreEmptyLines: options.ignoreEmptyLines,
    },
  })
  const output = options.findingsOnly ? getFindings(metrics) : metrics
  const filters = options.ruleFilters ?? []

  if (filters.length === 0) {
    return output
  }

  return output.filter((metric) => filters.includes(metric.type))
}
