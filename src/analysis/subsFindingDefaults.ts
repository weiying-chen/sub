import type { Metric } from "./types"

export const DEFAULT_SUBS_FINDING_RULE_TYPES: Metric["type"][] = [
  "MAX_CPS",
  "MAX_CHARS",
  "BLOCK_STRUCTURE",
  "TIMESTAMP_FORMAT",
  "NUMBER_STYLE",
  "DASH_STYLE",
  "PERCENT_STYLE",
  "PUNCTUATION",
  "SPAN_GAP",
  "JOINABLE_BREAK",
  "MIN_CPS",
  "MERGE_CANDIDATE",
  "BASELINE",
]

export function resolveSubsFindingRuleFilters(
  ruleFilters?: Metric["type"][]
): Metric["type"][] {
  if (ruleFilters != null && ruleFilters.length > 0) {
    return [...ruleFilters]
  }
  return [...DEFAULT_SUBS_FINDING_RULE_TYPES]
}
