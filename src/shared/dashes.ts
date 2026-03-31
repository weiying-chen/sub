export const EM_DASH = "\u2014"
export const EN_DASH = "\u2013"
export const TRIPLE_HYPHEN = "---"

export const DASH_VARIANTS = [EM_DASH, EN_DASH] as const
export const DASH_VARIANTS_RE = /[\u2013\u2014]/g
