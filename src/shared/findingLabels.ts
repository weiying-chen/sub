import type { Finding } from "../analysis/types"

const FINDING_LABELS: Partial<Record<Finding["type"], string>> = {
  MAX_CPS: "Reading speed is too high",
  MIN_CPS: "Reading speed is too low",
  CPS_BALANCE: "Reading speed changes too much",
  MERGE_CANDIDATE: "Lines could be merged",
  MAX_CHARS: "Line has too many characters",
  NUMBER_STYLE: "Number format is incorrect",
  PERCENT_STYLE: "Percent format is incorrect",
  CAPITALIZATION: "Capitalization is incorrect",
  LEADING_WHITESPACE: "Line starts with extra spaces",
  PUNCTUATION: "Punctuation is incorrect",
  BASELINE: "Text does not match baseline",
  MISSING_TRANSLATION: "Translation is missing",
}

export function getFindingLabel(finding: Finding): string {
  return FINDING_LABELS[finding.type] ?? finding.type
}
