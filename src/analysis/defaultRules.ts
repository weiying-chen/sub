import type { Rule } from './types'

import { maxCharsRule } from './maxCharsRule'
import { cpsRule } from './cpsRule'
import { cpsBalanceRule } from './cpsBalanceRule'

export function defaultRules(): Rule[] {
  return [
    maxCharsRule(54),
    cpsRule(),
    cpsBalanceRule(),
  ]
}
