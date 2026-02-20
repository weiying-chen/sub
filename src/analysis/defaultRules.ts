import type { Rule } from './types'
import type { SegmentRule } from './segments'

import { maxCharsRule } from './maxCharsRule'
import { leadingWhitespaceRule } from './leadingWhitespaceRule'
import { cpsBalanceRule } from './cpsBalanceRule'
import { capitalizationRule } from './capitalizationRule'
import { percentStyleRule } from './percentStyleRule'
import { mergeCandidateRule } from './mergeCandidateRule'
import { maxCpsRule } from './maxCpsRule'
import { minCpsRule } from './minCpsRule'

type DefaultRulesOptions = {
  capitalizationTerms?: string[]
  ignoreEmptyLines?: boolean
}

export function defaultRules(options: DefaultRulesOptions = {}): Rule[] {
  return [
    maxCharsRule(54),
    leadingWhitespaceRule(),
    maxCpsRule(undefined, undefined, {
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    minCpsRule(undefined, undefined, {
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
    leadingWhitespaceRule(),
    maxCpsRule(undefined, undefined, {
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    minCpsRule(undefined, undefined, {
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    cpsBalanceRule({ ignoreEmptyLines: options.ignoreEmptyLines }),
    mergeCandidateRule({ ignoreEmptyLines: options.ignoreEmptyLines }),
    capitalizationRule({ terms: options.capitalizationTerms }),
    percentStyleRule(),
  ]
}
