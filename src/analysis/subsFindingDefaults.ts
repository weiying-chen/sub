import type { Metric } from "./types"

export const DEFAULT_SUBS_FINDING_RULE_TYPES: Metric["type"][] = [
  "MAX_CHARS",
  "BLOCK_STRUCTURE",
  "TIMESTAMP_FORMAT",
  "LEADING_WHITESPACE",
  "SPAN_GAP",
  "MERGE_CANDIDATE",
  "JOINABLE_BREAK",
  "CAPITALIZATION",
  "DASH_STYLE",
  "PERCENT_STYLE",
  "NUMBER_STYLE",
  "PUNCTUATION",
  "MAX_CPS",
  "MIN_CPS",
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
