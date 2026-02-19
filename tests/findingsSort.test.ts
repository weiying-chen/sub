import { describe, expect, it } from "vitest"

import type { Finding } from "../src/analysis/types"
import { sortFindingsWithIndex } from "../src/shared/findingsSort"

describe("sortFindingsWithIndex", () => {
  it("orders by severity, then line, then type, then stable index", () => {
    const findings: Finding[] = [
      {
        type: "MIN_CPS",
        lineIndex: 2,
        text: "warn-1",
        cps: 7,
        minCps: 10,
        durationFrames: 24,
        charCount: 6,
        severity: "warn",
      },
      {
        type: "PUNCTUATION",
        lineIndex: 2,
        text: "err-2",
        ruleCode: "MISSING_END_PUNCTUATION",
        instruction: "Fix punctuation.",
        severity: "error",
      },
      {
        type: "NUMBER_STYLE",
        lineIndex: 1,
        index: 0,
        value: 5,
        found: "digits",
        expected: "words",
        token: "5",
        text: "5 days",
        severity: "error",
      },
      {
        type: "PERCENT_STYLE",
        lineIndex: 1,
        index: 1,
        token: "5%",
        text: "5% growth",
        expected: "percent",
        severity: "error",
      },
      {
        type: "MIN_CPS",
        lineIndex: 2,
        text: "warn-2",
        cps: 8,
        minCps: 10,
        durationFrames: 24,
        charCount: 6,
        severity: "warn",
      },
    ]

    const sorted = sortFindingsWithIndex(findings)

    expect(sorted.map((x) => x.finding.type)).toEqual([
      "NUMBER_STYLE",
      "PERCENT_STYLE",
      "PUNCTUATION",
      "MIN_CPS",
      "MIN_CPS",
    ])

    expect(sorted[3]?.index).toBe(0)
    expect(sorted[4]?.index).toBe(4)
  })
})
