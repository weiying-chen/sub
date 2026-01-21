import { describe, it, expect } from "vitest"
import { analyzeLines } from "../src/analysis/analyzeLines"
import { percentStyleRule } from "../src/analysis/percentStyleRule"

describe("percentStyleRule", () => {
  it("flags digit percent and ignores percent symbol", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "It rose 5 percent this year.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "It rose 5% last year.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "It rose 12.5 percent overall.",
      "00:00:04:00\t00:00:05:00\tMarker",
      "It rose 12.5% overall.",
    ].join("\n")

    const metrics = analyzeLines(text, [percentStyleRule()])
    const findings = metrics.filter((m) => m.type === "PERCENT_STYLE")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["12.5 percent", "5 percent"])
  })
})
