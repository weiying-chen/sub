import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { capitalizationRule } from '../analysis/capitalizationRule'
import {
  createSubsFindingsRules,
  createSubsMetricsRules,
} from '../analysis/subsSegmentRules'
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
  ignoreEmptyLines?: boolean,
  enabledFindingTypes?: Metric['type'][],
  findingsOnly?: boolean
) {
  const enabled = enabledFindingTypes
    ? new Set<Metric['type']>(enabledFindingTypes)
    : null
  const capitalizationTerms = await loadCapitalizationTerms()
  if (type === 'news') {
    const rules = []
    if (!enabled || enabled.has('MAX_CHARS')) rules.push(maxCharsRule(54))
    if (!enabled || enabled.has('NUMBER_STYLE')) rules.push(numberStyleRule())
    if (!enabled || enabled.has('CAPITALIZATION')) {
      rules.push(
        capitalizationRule({
          terms: capitalizationTerms ?? undefined,
        })
      )
    }
    return rules
  }

  const properNouns = await loadProperNouns()
  const assembly = findingsOnly ? createSubsFindingsRules : createSubsMetricsRules
  return assembly({
    capitalizationTerms: capitalizationTerms ?? undefined,
    properNouns: properNouns ?? undefined,
    ignoreEmptyLines,
    enabledFindingTypes,
  })
}

export async function buildMetricsOutput(
  text: string,
  options: MetricsOptions
): Promise<Metric[] | Finding[]> {
  const enabledFindingTypes =
    (options.ruleFilters?.length ?? 0) > 0
      ? (options.ruleFilters as Metric['type'][])
      : undefined
  const rules = await buildRules(
    options.type,
    options.ignoreEmptyLines,
    enabledFindingTypes,
    options.findingsOnly
  )
  const metrics = analyzeTextByType(text, options.type, rules, {
    parseOptions: {
      ignoreEmptyLines: options.ignoreEmptyLines,
    },
  })
  return options.findingsOnly ? getFindings(metrics) : metrics
}
