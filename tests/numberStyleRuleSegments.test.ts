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
      { lineIndex: 15, text: "We raised 1,000 dollars." },
      { lineIndex: 16, text: "If we can make it five-two-seven." },
      { lineIndex: 17, text: "About 10,000 people attended." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, text: segment.text },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["12", "5", "eleven"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("5")?.expected).toBe("words")
    expect(byToken.get("5")?.found).toBe("digits")
    expect(byToken.get("5")?.text).toBe("This is 5 examples.")
    expect(byToken.get("eleven")?.expected).toBe("digits")
    expect(byToken.get("eleven")?.found).toBe("words")
    expect(byToken.get("eleven")?.text).toBe("This is eleven examples.")
    expect(byToken.get("12")?.expected).toBe("words")
    expect(byToken.get("12")?.found).toBe("digits")
    expect(byToken.get("12")?.text).toBe("12 birds landed.")
  })

  it("ignores non-English text blocks", () => {
    const segments = [
      { lineIndex: 0, text: "( 01/01 )", targetLines: [] },
      { lineIndex: 1, text: "Metadata line.", targetLines: [] },
      { lineIndex: 2, text: "( speaker )", targetLines: [] },
    ]

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores age adjectives like twelve-year-old", () => {
    const segments = [
      { lineIndex: 0, text: "Twelve-year-old Alex went home." },
      { lineIndex: 1, text: "She is a twelve year old student." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, text: segment.text },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores currency amounts with symbols", () => {
    const segments = [
      { lineIndex: 0, text: "It's about NT$1 million per bed." },
      { lineIndex: 1, text: "The estimate is US$ 2 million total." },
      { lineIndex: 2, text: "He paid $3 yesterday." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, text: segment.text },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })
})
