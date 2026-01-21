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
      "00:00:08:00\t00:00:09:00\tMarker",
      "We raised 1,000 dollars.",
      "00:00:08:10\t00:00:09:10\tMarker",
      "If we can make it five-two-seven.",
      "00:00:09:00\t00:00:10:00\tMarker",
      "About 10,000 people attended.",
      "00:00:10:00\t00:00:11:00\tMarker",
      "It rose 5 percent this year.",
      "00:00:11:00\t00:00:12:00\tMarker",
      "It rose 5% last year.",
    ].join("\n")

    const metrics = analyzeLines(text, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["12", "5", "eleven"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("5")?.expected).toBe("words")
    expect(byToken.get("5")?.found).toBe("digits")
    expect(byToken.get("eleven")?.expected).toBe("digits")
    expect(byToken.get("eleven")?.found).toBe("words")
    expect(byToken.get("12")?.expected).toBe("words")
    expect(byToken.get("12")?.found).toBe("digits")
  })
})
