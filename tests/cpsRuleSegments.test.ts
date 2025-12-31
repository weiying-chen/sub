import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { cpsRule } from "../src/analysis/cpsRule"

describe("cpsRule (segments)", () => {
  it("merges identical consecutive payloads and anchors to timestamp lines", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Bye",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [cpsRule()])

    expect(metrics).toHaveLength(2)

    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    const hi = byLine.get(0)
    const bye = byLine.get(4)

    expect(hi?.durationFrames).toBe(60)
    expect(hi?.charCount).toBe(2)
    expect(hi?.cps).toBe(1)

    expect(bye?.durationFrames).toBe(30)
    expect(bye?.charCount).toBe(3)
    expect(bye?.cps).toBe(3)
  })
})
