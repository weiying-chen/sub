export const TIMESTAMP_FORMAT_ROW_FORMAT =
  "HH:MM:SS:FF<TAB>HH:MM:SS:FF<TAB>original text"

export const TIMESTAMP_FORMAT_FINDING_INSTRUCTION =
  `Use a row with timestamps in this format: ${TIMESTAMP_FORMAT_ROW_FORMAT}. You can optionally add XXX before the first timestamp.`

export const TIMESTAMP_FORMAT_MODAL_EXPLANATION =
  "Flags a timestamp that does not match the allowed format. You can optionally add XXX before the first timestamp."
