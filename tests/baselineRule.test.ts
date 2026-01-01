import { describe, it, expect } from "vitest"

import { analyzeLines } from "../src/analysis/analyzeLines"
import { baselineRule } from "../src/analysis/baselineRule"
import type { BaselineMetric } from "../src/analysis/types"

function getBaselineFindings(baselineText: string, currentText: string) {
  const metrics = analyzeLines(currentText, [baselineRule(baselineText)])
  return metrics.filter((m): m is BaselineMetric => m.type === "BASELINE")
}

describe("baselineRule", () => {
  it("ignores non-timestamp lines and blank lines", () => {
    const baseline = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "Baseline text",
      "",
      "00:00:02:00\t00:00:03:00\tSRC2",
    ].join("\n")

    const current = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "Translated line that should be ignored",
      "",
      "00:00:02:00\t00:00:03:00\tSRC2",
    ].join("\n")

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toEqual([])
  })

  it("flags inline source text edits on timestamp lines", () => {
    const baseline = "00:00:01:00\t00:00:02:00\tSRC1"
    const current = "00:00:01:00\t00:00:02:00\tSRC1 EDIT"

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      message: "Inline source text mismatch vs baseline",
      expected: "SRC1",
      actual: "SRC1 EDIT",
    })
  })

  it("flags missing timestamp lines vs baseline", () => {
    const baseline = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "00:00:02:00\t00:00:03:00\tSRC2",
    ].join("\n")
    const current = "00:00:01:00\t00:00:02:00\tSRC1"

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      lineIndex: 0,
      message: "Missing timestamp line vs baseline",
      expected: "00:00:02:00 -> 00:00:03:00",
      baselineLineIndex: 1,
    })
  })

  it("does not cascade when a timestamp line is missing", () => {
    const baseline = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "00:00:02:00\t00:00:03:00\tSRC2",
      "00:00:03:00\t00:00:04:00\tSRC3",
    ].join("\n")
    const current = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "00:00:03:00\t00:00:04:00\tSRC3",
    ].join("\n")

    const findings = getBaselineFindings(baseline, current)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "BASELINE",
      lineIndex: 1,
      message: "Missing timestamp line vs baseline",
      expected: "00:00:02:00 -> 00:00:03:00",
      baselineLineIndex: 1,
    })
  })
})
