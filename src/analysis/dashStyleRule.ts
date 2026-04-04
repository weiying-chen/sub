import type { SegmentCtx, SegmentRule } from "./segments"
import type { DashStyleMetric } from "./types"
import { EM_DASH, EN_DASH, TRIPLE_HYPHEN } from "../shared/dashes"

type DashStyle = "em_dash" | "en_dash" | "triple_hyphen"
type ExpectedDashStyle = "em_dash" | "triple_hyphen"
type DashContext = "subs" | "vo" | "super"

function expectedDashStyle(ctx: SegmentCtx): {
  expected: ExpectedDashStyle
  blockType: DashContext
} | null {
  if (ctx.segment.blockType === "vo") {
    return { expected: "em_dash", blockType: "vo" }
  }
  if (ctx.segment.blockType === "super") {
    return { expected: "triple_hyphen", blockType: "super" }
  }
  if (ctx.segment.blockType == null) {
    return { expected: "triple_hyphen", blockType: "subs" }
  }
  return null
}

function findUnexpectedDash(
  text: string,
  expected: ExpectedDashStyle
): { found: DashStyle; index: number; token: string } | null {
  const candidates: Array<{ style: DashStyle; token: string }> =
    expected === "em_dash"
      ? [
          { style: "triple_hyphen", token: TRIPLE_HYPHEN },
          { style: "en_dash", token: EN_DASH },
        ]
      : [
          { style: "em_dash", token: EM_DASH },
          { style: "en_dash", token: EN_DASH },
        ]

  let best: { found: DashStyle; index: number; token: string } | null = null
  for (const candidate of candidates) {
    const index = text.indexOf(candidate.token)
    if (index < 0) continue
    if (!best || index < best.index) {
      best = { found: candidate.style, index, token: candidate.token }
    }
  }

  return best
}

export function dashStyleRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    const policy = expectedDashStyle(ctx)
    if (!policy) return []

    const text = ctx.segment.translation
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
