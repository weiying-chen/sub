import type { Rule, MaxCpsMetric, RuleCtx } from "./types"

import { MAX_CPS, MIN_CPS } from "../shared/subtitles"
import type { ParseBlockOptions } from "../shared/tsvRuns"
import type { SegmentCtx, SegmentRule } from "./segments"
import { cpsRule } from "./cpsRule"

type MaxCpsRule = Rule & SegmentRule

export function maxCpsRule(
  maxCps: number = MAX_CPS,
  minCps: number = MIN_CPS,
  options: ParseBlockOptions = {}
): MaxCpsRule {
  const collect = cpsRule(maxCps, minCps, options)
  return ((ctx: RuleCtx | SegmentCtx) => {
    const metrics =
      "segment" in ctx
        ? collect(ctx).filter((m) => m.type === "CPS")
        : collect(ctx).filter((m) => m.type === "CPS")
    return metrics.flatMap((metric) => {
      if (metric.cps <= metric.maxCps) return []
      const finding: MaxCpsMetric = {
        type: "MAX_CPS",
        lineIndex: metric.lineIndex,
        tsLineIndex: metric.tsLineIndex,
        text: metric.text,
        cps: metric.cps,
        maxCps: metric.maxCps,
        durationFrames: metric.durationFrames,
        charCount: metric.charCount,
        severity: "error",
      }
      return [finding]
    })
  }) as MaxCpsRule
}
