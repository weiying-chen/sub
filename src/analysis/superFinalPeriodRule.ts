import type { SegmentCtx, SegmentRule } from "./segments"
import type { Metric } from "./types"

export type PeriodInCaptionMetric = {
  type: "PERIOD_IN_CAPTION"
  lineIndex: number
  text: string
  severity?: "error" | "warn"
}

function stripTrailingClosers(text: string): string {
  return text.replace(/["'\)\]\}）］】》]+$/g, "")
}

function hasTrailingPeriod(text: string): boolean {
  const trimmed = stripTrailingClosers(text.trimEnd())
  if (!trimmed.endsWith(".")) return false
  return !trimmed.slice(0, -1).endsWith(".")
}

export function periodInCaptionRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const { segment } = ctx
    if (segment.blockType !== "super") return []

    const targetLines = segment.targetLines ?? []
    if (targetLines.length === 0) return []

    const lastLine = targetLines[targetLines.length - 1]
    if (!lastLine) return []
    if (!hasTrailingPeriod(lastLine.lineText)) return []

    return [
      {
        type: "PERIOD_IN_CAPTION",
        lineIndex: lastLine.lineIndex,
        text: lastLine.lineText,
      } satisfies PeriodInCaptionMetric,
    ] satisfies Metric[]
  }) as SegmentRule
}
