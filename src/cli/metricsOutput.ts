import { buildAnalysisOutput } from '../analysis/buildAnalysisOutput'
import type { Metric, Finding } from '../analysis/types'
import {
  loadAbbreviations,
  loadCapitalizationTerms,
  loadProperNouns,
} from './properNouns'

export type MetricsOptions = {
  type: 'subs' | 'news'
  mode?: 'metrics' | 'findings'
  ruleFilters?: string[]
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
  const abbreviations = options.type === 'subs' ? await loadAbbreviations() : undefined
  const mode = options.mode ?? 'metrics'

  return buildAnalysisOutput({
    text,
    type: options.type,
    ruleSet: mode,
    output: mode,
    enabledRuleTypes: enabledFindingTypes,
    capitalizationTerms: capitalizationTerms ?? undefined,
    properNouns: properNouns ?? undefined,
    abbreviations: abbreviations ?? undefined,
    ignoreEmptyLines: options.ignoreEmptyLines,
  })
}
