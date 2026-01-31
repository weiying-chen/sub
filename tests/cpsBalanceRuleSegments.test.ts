import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { cpsBalanceRule } from "../src/analysis/cpsBalanceRule"

describe("cpsBalanceRule (segments)", () => {
  it("reports the faster run when delta exceeds threshold", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This is a very long line.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [cpsBalanceRule()])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "CPS_BALANCE",
      lineIndex: 0,
      cps: 25,
      neighborCps: 3,
      deltaCps: 22,
      text: "This is a very long line.",
    })
  })
})
