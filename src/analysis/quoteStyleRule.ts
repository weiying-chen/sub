import type { SegmentCtx, SegmentRule } from "./segments"
import type { QuoteStyleMetric } from "./types"

const QUOTE_STYLE: QuoteStyleMetric["token"][] = ["“", "”", "‘", "’"]

function findCurlyQuote(text: string): { token: QuoteStyleMetric["token"]; index: number } | null {
  let best: { token: QuoteStyleMetric["token"]; index: number } | null = null
  for (const token of QUOTE_STYLE) {
    const index = text.indexOf(token)
    if (index < 0) continue
    if (!best || index < best.index) {
      best = { token, index }
    }
  }
  return best
}

function collectMetric(text: string, lineIndex: number): QuoteStyleMetric[] {
  if (!text.trim()) return []
  const hit = findCurlyQuote(text)
  if (!hit) return []
  return [
    {
      type: "QUOTE_STYLE",
      lineIndex,
      index: hit.index,
      token: hit.token,
      text,
      severity: "error",
    },
  ]
}

export function quoteStyleRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    if (ctx.segment.targetLines) {
      return ctx.segment.targetLines.flatMap((line) =>
        collectMetric(line.lineText, line.lineIndex)
      )
    }
    return collectMetric(ctx.segment.translation, ctx.segment.lineIndex)
  }
}
