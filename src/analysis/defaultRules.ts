import type { Rule } from './types'
import type { SegmentRule } from './segments'

import { maxCharsRule } from './maxCharsRule'
import { cpsRule } from './cpsRule'
import { cpsBalanceRule } from './cpsBalanceRule'
import { capitalizationRule } from './capitalizationRule'
import { percentStyleRule } from './percentStyleRule'

type DefaultRulesOptions = {
  capitalizationTerms?: string[]
  ignoreEmptyLines?: boolean
}

export function defaultRules(options: DefaultRulesOptions = {}): Rule[] {
  return [
    maxCharsRule(54),
    cpsRule(undefined, undefined, {
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    cpsBalanceRule({ ignoreEmptyLines: options.ignoreEmptyLines }),
    capitalizationRule({ terms: options.capitalizationTerms }),
    percentStyleRule(),
  ]
}

export function defaultSegmentRules(
  options: DefaultRulesOptions = {}
): SegmentRule[] {
  return [
    maxCharsRule(54),
    cpsRule(undefined, undefined, {
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    cpsBalanceRule({ ignoreEmptyLines: options.ignoreEmptyLines }),
    capitalizationRule({ terms: options.capitalizationTerms }),
    percentStyleRule(),
  ]
}
