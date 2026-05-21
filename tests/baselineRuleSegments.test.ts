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
  it("flags source text edits on timestamp lines", () => {
    const baseline = "00:00:01:00\t00:00:02:00\tSRC1"
    const current = "00:00:01:00\t00:00:02:00\tSRC1 EDIT"

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      ruleCode: "SOURCE_TEXT_MISMATCH",
      message: "Original text mismatch between current file and baseline file.",
      reason: "sourceText",
      timestamp: "00:00:01:00 -> 00:00:02:00",
      expected: "SRC1",
      actual: "SRC1 EDIT",
    })
  })

  it("still checks later baseline entries when first block is skipped parenthetical", () => {
    const baseline = [
      "XXX\t00:00:20:00\t00:00:25:14\t慈善與共善",
      "(Charity and the common good)",
      "00:00:26:08\t00:00:27:18\t很多藝術都有",
      "Art can feel distant to people.",
    ].join("\n")
    const current = [
      "XXX\t00:00:20:00\t00:00:25:14\t慈善與共善",
      "(Charity and the common good)",
    ].join("\n")

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      ruleCode: "MISSING_TIMESTAMP_LINE",
      baselineLineIndex: 2,
    })
  })
})
