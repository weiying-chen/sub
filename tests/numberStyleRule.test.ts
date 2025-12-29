import { describe, it, expect } from "vitest"
import { analyzeLines } from "../src/analysis/analyzeLines"
import { numberStyleRule } from "../src/analysis/numberStyleRule"

describe("numberStyleRule", () => {
  it("flags digit/word violations and ignores sentence starts + time", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This is 5 examples.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "This is eleven examples.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Eleven examples start a sentence.",
      "00:00:04:00\t00:00:05:00\tMarker",
      "It happened at 3:30 yesterday.",
      "00:00:05:00\t00:00:06:00\tMarker",
      "We saw 12 birds.",
      "00:00:06:00\t00:00:07:00\tMarker",
      "12 birds landed.",
      "00:00:07:00\t00:00:08:00\tMarker",
      "Twenty two birds landed.",
    ].join("\n")

    const metrics = analyzeLines(text, [numberStyleRule()])
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
