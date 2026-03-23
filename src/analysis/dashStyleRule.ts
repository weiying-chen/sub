import type { SegmentCtx, SegmentRule } from "./segments"
import type { DashStyleMetric } from "./types"

type DashStyle = "EM_DASH" | "TRIPLE_HYPHEN"
type DashContext = "subs" | "vo" | "super"

const EM_DASH = "\u2014"
const TRIPLE_HYPHEN = "---"

function expectedDashStyle(ctx: SegmentCtx): {
  expected: DashStyle
  blockType: DashContext
} | null {
  if (ctx.segment.blockType === "vo") {
    return { expected: "EM_DASH", blockType: "vo" }
  }
  if (ctx.segment.blockType === "super") {
    return { expected: "TRIPLE_HYPHEN", blockType: "super" }
  }
  if (ctx.segment.blockType == null) {
    return { expected: "TRIPLE_HYPHEN", blockType: "subs" }
  }
  return null
}

function findUnexpectedDash(
  text: string,
  expected: DashStyle
): { found: DashStyle; index: number; token: string } | null {
  const unexpectedToken = expected === "EM_DASH" ? TRIPLE_HYPHEN : EM_DASH
  const index = text.indexOf(unexpectedToken)
  if (index < 0) return null
  return {
    found: expected === "EM_DASH" ? "TRIPLE_HYPHEN" : "EM_DASH",
    index,
    token: unexpectedToken,
  }
}

export function dashStyleRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    const policy = expectedDashStyle(ctx)
    if (!policy) return []

    const text = ctx.segment.text
    if (!text) return []

    const mismatch = findUnexpectedDash(text, policy.expected)
    if (!mismatch) return []

    const metric: DashStyleMetric = {
      type: "DASH_STYLE",
      lineIndex: ctx.segment.lineIndex,
      index: mismatch.index,
      token: mismatch.token,
      text,
      expected: policy.expected,
      found: mismatch.found,
      blockType: policy.blockType,
      severity: "error",
    }

    return [metric]
  }
}
