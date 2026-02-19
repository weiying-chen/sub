import { baselineRule } from "./baselineRule"
import { defaultSegmentRules } from "./defaultRules"
import { numberStyleRule } from "./numberStyleRule"
import { punctuationRule } from "./punctuationRule"
import type { SegmentRule } from "./segments"

type CreateSubsSegmentRulesOptions = {
  capitalizationTerms?: string[]
  properNouns?: string[]
  baselineText?: string
  ignoreEmptyLines?: boolean
}

export function createSubsSegmentRules(
  options: CreateSubsSegmentRulesOptions = {}
): SegmentRule[] {
  const rules: SegmentRule[] = [
    ...defaultSegmentRules({
      capitalizationTerms: options.capitalizationTerms,
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
    numberStyleRule(),
    punctuationRule({
      properNouns: options.properNouns,
      ignoreEmptyLines: options.ignoreEmptyLines,
    }),
  ]

  if (options.baselineText != null) {
    rules.push(baselineRule(options.baselineText))
  }

  return rules
}
