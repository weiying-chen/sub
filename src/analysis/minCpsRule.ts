import type { Rule, MinCpsMetric, RuleCtx } from "./types"

import { MAX_CPS, MIN_CPS } from "../shared/subtitles"
import type { ParseBlockOptions } from "../shared/tsvRuns"
import type { SegmentCtx, SegmentRule } from "./segments"
import { cpsRule } from "./cpsRule"

type MinCpsRule = Rule & SegmentRule

export function minCpsRule(
  maxCps: number = MAX_CPS,
  minCps: number = MIN_CPS,
  options: ParseBlockOptions = {}
): MinCpsRule {
  const collect = cpsRule(maxCps, minCps, options)
  return ((ctx: RuleCtx | SegmentCtx) => {
    const metrics =
      "segment" in ctx
        ? collect(ctx).filter((m) => m.type === "CPS")
        : collect(ctx).filter((m) => m.type === "CPS")
    return metrics.flatMap((metric) => {
      if (metric.cps >= metric.minCps) return []
      const finding: MinCpsMetric = {
        type: "MIN_CPS",
        lineIndex: metric.lineIndex,
        tsLineIndex: metric.tsLineIndex,
        text: metric.text,
        cps: metric.cps,
        minCps: metric.minCps,
        durationFrames: metric.durationFrames,
        charCount: metric.charCount,
        severity: "warn",
      }
      return [finding]
    })
  }) as MinCpsRule
}
