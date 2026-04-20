import type { Metric } from "./types"

export const DEFAULT_TEXT_FINDING_RULE_TYPES: Metric["type"][] = [
  "MAX_CHARS",
  "LEADING_WHITESPACE",
  "NUMBER_STYLE",
  "PERCENT_STYLE",
  "DASH_STYLE",
  "QUOTE_STYLE",
  "PUNCTUATION",
  "CAPITALIZATION",
]

export function resolveTextFindingRuleFilters(
  ruleFilters?: Metric["type"][]
): Metric["type"][] {
  if (ruleFilters != null && ruleFilters.length > 0) {
    return [...ruleFilters]
  }
  return [...DEFAULT_TEXT_FINDING_RULE_TYPES]
}
