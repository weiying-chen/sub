import type { Finding } from "../analysis/types"

export const TIMESTAMP_FORMAT_ROW_FORMAT =
  "HH:MM:SS:FF<TAB>HH:MM:SS:FF<TAB>original text"

export const TIMESTAMP_FORMAT_FINDING_INSTRUCTION =
  `Use a row with timestamps in this format: ${TIMESTAMP_FORMAT_ROW_FORMAT}. You can optionally add XXX before the first timestamp.`

export const TIMESTAMP_FORMAT_MODAL_EXPLANATION =
  "Flags a timestamp that does not match the allowed format. You can optionally add XXX before the first timestamp."

export const RULE_MODAL_EXPLANATIONS: Partial<Record<Finding["type"], string>> = {
  BLOCK_STRUCTURE: "Flags a timestamp that is missing a translation line.",
  TIMESTAMP_FORMAT: TIMESTAMP_FORMAT_MODAL_EXPLANATION,
  MAX_CPS:
    "Flags a translation line with reading speed above the maximum CPS limit. You can edit it in the input below.",
  MAX_CHARS: "Flags a translation line with 55 or more characters.",
  PUNCTUATION:
    "Checks sentence-ending punctuation, punctuation continuity between adjacent translation lines, and quote matching.",
  NUMBER_STYLE: "Checks number formatting and spelling style conventions.",
  PERCENT_STYLE: "Checks percent formatting style. Use % instead of the word \"percent\".",
  DASH_STYLE: "Checks dash style in a translation line. Use --- instead of —.",
  MIN_CPS:
    "Warns when a translation line has reading speed below the minimum CPS limit. You can edit it in the input below.",
  SPAN_GAP: "Warns when a translation line spans across a timing gap.",
  MERGE_CANDIDATE:
    "Warns when neighboring lines are very similar and may be the same translation with minor typos.",
  JOINABLE_BREAK:
    "Warns when neighboring translation lines can be joined and still stay within the max character limit.",
}
