import { readFile } from 'node:fs/promises'

import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { capitalizationRule } from '../analysis/capitalizationRule'
import { defaultSegmentRules } from '../analysis/defaultRules'
import { maxCharsRule } from '../analysis/maxCharsRule'
import { numberStyleRule } from '../analysis/numberStyleRule'
import { punctuationRuleWithOptions } from '../analysis/punctuationRule'
import type { Metric, Finding } from '../analysis/types'
import { getFindings } from '../shared/findings'

export type MetricsOptions = {
  type: 'subs' | 'news'
  ruleFilters?: string[]
  findingsOnly?: boolean
}

const PROPER_NOUNS_PATH = 'punctuation-proper-nouns.txt'

async function loadProperNouns() {
  try {
    const raw = await readFile(PROPER_NOUNS_PATH, 'utf8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
  } catch {
    return null
  }
}

async function buildRules(type: 'subs' | 'news') {
  if (type === 'news') {
    return [maxCharsRule(54), numberStyleRule(), capitalizationRule()]
  }

  const properNouns = await loadProperNouns()
  return [
    ...defaultSegmentRules(),
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
