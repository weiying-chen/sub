import type { Rule } from './types'
import type { SegmentRule } from './segments'

import { maxCharsRule } from './maxCharsRule'
import { cpsRule } from './cpsRule'
import { cpsBalanceRule } from './cpsBalanceRule'
import { capitalizationRule } from './capitalizationRule'

export function defaultRules(): Rule[] {
  return [
    maxCharsRule(54),
    cpsRule(),
    cpsBalanceRule(),
    capitalizationRule(),
  ]
}

export function defaultSegmentRules(): SegmentRule[] {
  return [
    maxCharsRule(54),
    cpsRule(),
    cpsBalanceRule(),
    capitalizationRule(),
  ]
}
