import type { Metric } from "./types"

export const DEFAULT_SUBS_FINDING_RULE_TYPES: Metric["type"][] = [
  "MAX_CHARS",
  "MERGE_CANDIDATE",
  "NUMBER_STYLE",
  "PUNCTUATION",
  "MAX_CPS",
  "MIN_CPS",
]

export function resolveSubsFindingRuleFilters(
  ruleFilters?: Metric["type"][]
): Metric["type"][] {
  if (ruleFilters != null && ruleFilters.length > 0) {
    return [...ruleFilters]
  }
  return [...DEFAULT_SUBS_FINDING_RULE_TYPES]
}
