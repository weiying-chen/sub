import { buildAnalysisOutput } from '../analysis/buildAnalysisOutput'
import type { Metric, Finding } from '../analysis/types'
import { resolveSubsFindingRuleFilters } from '../analysis/subsFindingDefaults'
import { resolveTextFindingRuleFilters } from '../analysis/textFindingDefaults'
import {
  loadAbbreviations,
  loadCapitalizationTerms,
  loadProperNouns,
} from './properNouns'

export type AnalyzeOptions = {
  type: 'subs' | 'news' | 'text'
  mode?: 'metrics' | 'findings'
  ruleFilters?: string[]
  baselineText?: string
  ignoreEmptyLines?: boolean
  includeWarnings?: boolean
}

export async function buildAnalyzeOutput(
  text: string,
  options: AnalyzeOptions
): Promise<Metric[] | Finding[]> {
  const enabledFindingTypes =
    options.type === 'subs'
      ? resolveSubsFindingRuleFilters(options.ruleFilters as Metric['type'][] | undefined)
      : options.type === 'text'
        ? resolveTextFindingRuleFilters(options.ruleFilters as Metric['type'][] | undefined)
      : (options.ruleFilters?.length ?? 0) > 0
        ? (options.ruleFilters as Metric['type'][])
        : undefined
  const capitalizationTerms = await loadCapitalizationTerms()
  const properNouns =
    options.type === 'subs' || options.type === 'text'
      ? await loadProperNouns()
      : undefined
  const abbreviations =
    options.type === 'subs' || options.type === 'text'
      ? await loadAbbreviations()
      : undefined
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
    baselineText: options.baselineText,
    ignoreEmptyLines: options.ignoreEmptyLines,
    includeWarnings: options.includeWarnings,
  })
}
