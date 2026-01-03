import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { baselineRule } from "../src/analysis/baselineRule"
import type { BaselineMetric } from "../src/analysis/types"

function getBaselineFindings(baselineText: string, currentText: string) {
  const metrics = analyzeTextByType(currentText, "subs", [
    baselineRule(baselineText),
  ])
  return metrics.filter((m): m is BaselineMetric => m.type === "BASELINE")
}

describe("baselineRule (segments)", () => {
  it("flags inline source text edits on timestamp lines", () => {
    const baseline = "00:00:01:00\t00:00:02:00\tSRC1"
    const current = "00:00:01:00\t00:00:02:00\tSRC1 EDIT"

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      message: "Inline source text mismatch vs baseline",
      reason: "inlineText",
      timestamp: "00:00:01:00 -> 00:00:02:00",
      expected: "SRC1",
      actual: "SRC1 EDIT",
    })
  })
})
