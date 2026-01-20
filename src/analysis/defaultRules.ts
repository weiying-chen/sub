import type { Rule } from './types'
import type { SegmentRule } from './segments'

import { maxCharsRule } from './maxCharsRule'
import { cpsRule } from './cpsRule'
import { cpsBalanceRule } from './cpsBalanceRule'
import { capitalizationRule } from './capitalizationRule'

type DefaultRulesOptions = {
  capitalizationTerms?: string[]
}

export function defaultRules(options: DefaultRulesOptions = {}): Rule[] {
  return [
    maxCharsRule(54),
    cpsRule(),
    cpsBalanceRule(),
    capitalizationRule({ terms: options.capitalizationTerms }),
  ]
}

export function defaultSegmentRules(
  options: DefaultRulesOptions = {}
): SegmentRule[] {
  return [
    maxCharsRule(54),
    cpsRule(),
    cpsBalanceRule(),
    capitalizationRule({ terms: options.capitalizationTerms }),
  ]
}
