const OPEN_QUOTE_RE = /^\s*(["'])/
const DASH_TERMINAL_RE = /(?:—|---)/
const SENT_BOUNDARY_RE = new RegExp(
  `(?:[.!?:]|…|${DASH_TERMINAL_RE.source})(?:["'\\)\\]\\}]+)?\\s*$`
)

export function startsWithOpenQuote(s: string): string | null {
  const m = s.match(OPEN_QUOTE_RE)
  return m ? m[1] : null
}

export function endsSentenceBoundary(s: string): boolean {
  return SENT_BOUNDARY_RE.test(s.trimEnd())
}
