import type { Finding } from "../analysis/types"

const FINDING_LABELS: Partial<Record<Finding["type"], string>> = {
  MAX_CPS: "Reading speed is too high",
  MIN_CPS: "Reading speed is too low",
  CPS_BALANCE: "Reading speed changes too much",
  SPAN_GAP: "Translation line spans across a timing gap",
  MERGE_CANDIDATE: "Translation lines could be merged",
  JOINABLE_BREAK: "Translation lines can be joined",
  MAX_CHARS: "Translation line has too many characters",
  BLOCK_STRUCTURE: "Translation line is missing",
  TIMESTAMP_FORMAT: "Timestamp format is incorrect",
  NUMBER_STYLE: "Number format is incorrect",
  DASH_STYLE: "Dash style is incorrect",
  PERCENT_STYLE: "Percent format is incorrect",
  CAPITALIZATION: "Capitalization is incorrect",
  LEADING_WHITESPACE: "Translation line starts with extra spaces",
  PUNCTUATION: "Punctuation is incorrect",
  BASELINE: "Text does not match baseline",
  MISSING_TRANSLATION: "Translation line is missing",
  NEWS_MARKER: "News marker is incorrect",
  SUPER_PEOPLE: "SUPER entry is incorrect",
}

export function getFindingTypeLabel(type: Finding["type"]): string {
  return FINDING_LABELS[type] ?? type
}

export function getFindingLabel(finding: Finding): string {
  return getFindingTypeLabel(finding.type)
}
