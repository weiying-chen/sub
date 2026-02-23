import { buildAnalysisOutput } from '../analysis/buildAnalysisOutput'
import type { Metric, Finding } from '../analysis/types'
import { loadCapitalizationTerms, loadProperNouns } from './properNouns'

export type MetricsOptions = {
  type: 'subs' | 'news'
  ruleFilters?: string[]
  findingsOnly?: boolean
  ignoreEmptyLines?: boolean
}

export async function buildMetricsOutput(
  text: string,
  options: MetricsOptions
): Promise<Metric[] | Finding[]> {
  const enabledFindingTypes =
    (options.ruleFilters?.length ?? 0) > 0
      ? (options.ruleFilters as Metric['type'][])
      : undefined
  const capitalizationTerms = await loadCapitalizationTerms()
  const properNouns = options.type === 'subs' ? await loadProperNouns() : undefined

  return buildAnalysisOutput({
    text,
    type: options.type,
    ruleSet: options.findingsOnly ? 'findings' : 'metrics',
    output: options.findingsOnly ? 'findings' : 'metrics',
    enabledRuleTypes: enabledFindingTypes,
    capitalizationTerms: capitalizationTerms ?? undefined,
    properNouns: properNouns ?? undefined,
    ignoreEmptyLines: options.ignoreEmptyLines,
  })
}
