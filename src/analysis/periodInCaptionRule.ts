import type { SegmentCtx, SegmentRule } from "./segments"
import type { Metric } from "./types"
import {
  hasTrailingCaptionPeriod,
  isCaptionLine,
} from "./caption"

export type PeriodInCaptionMetric = {
  type: "PERIOD_IN_CAPTION"
  lineIndex: number
  text: string
  severity?: "error" | "warn"
}

export function periodInCaptionRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const { segment } = ctx
    const targetLines = segment.targetLines ?? []
    const fallbackText = segment.translation.trim()

    const lastLine =
      targetLines[targetLines.length - 1] ??
      (fallbackText !== ""
        ? { lineIndex: segment.lineIndex, lineText: segment.translation }
        : null)
    if (!lastLine) return []
    if (!isCaptionLine(lastLine.lineText)) return []
    if (!hasTrailingCaptionPeriod(lastLine.lineText)) return []

    return [
      {
        type: "PERIOD_IN_CAPTION",
        lineIndex: lastLine.lineIndex,
        text: lastLine.lineText,
      } satisfies PeriodInCaptionMetric,
    ] satisfies Metric[]
  }) as SegmentRule
}
