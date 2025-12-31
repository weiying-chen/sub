import { describe, it, expect } from "vitest"

import { analyzeSegments } from "../src/analysis/segments"
import { numberStyleRule } from "../src/analysis/numberStyleRule"

describe("numberStyleRule (segments)", () => {
  it("flags digit/word violations and ignores sentence starts + time", () => {
    const segments = [
      { lineIndex: 1, text: "This is 5 examples." },
      { lineIndex: 3, text: "This is eleven examples." },
      { lineIndex: 5, text: "Eleven examples start a sentence." },
      { lineIndex: 7, text: "It happened at 3:30 yesterday." },
      { lineIndex: 9, text: "We saw 12 birds." },
      { lineIndex: 11, text: "12 birds landed." },
      { lineIndex: 13, text: "Twenty two birds landed." },
    ]

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    const previews = findings.map((f) => f.preview).sort()
    expect(previews).toEqual(["12", "5", "eleven"])

    const byPreview = new Map(findings.map((f) => [f.preview, f]))
    expect(byPreview.get("5")?.expected).toBe("words")
    expect(byPreview.get("5")?.found).toBe("digits")
    expect(byPreview.get("eleven")?.expected).toBe("digits")
    expect(byPreview.get("eleven")?.found).toBe("words")
    expect(byPreview.get("12")?.expected).toBe("words")
    expect(byPreview.get("12")?.found).toBe("digits")
  })
})
