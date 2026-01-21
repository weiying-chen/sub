import { describe, it, expect } from "vitest"

import { analyzeSegments } from "../src/analysis/segments"
import { percentStyleRule } from "../src/analysis/percentStyleRule"

describe("percentStyleRule (segments)", () => {
  it("flags digit percent across segments", () => {
    const segments = [
      { lineIndex: 1, text: "It rose 5 percent this year." },
      { lineIndex: 3, text: "It rose 5% last year." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, text: segment.text },
      ],
    }))

    const metrics = analyzeSegments(segments, [percentStyleRule()])
    const findings = metrics.filter((m) => m.type === "PERCENT_STYLE")

    expect(findings).toHaveLength(1)
    expect(findings[0]?.token).toBe("5 percent")
  })
})
