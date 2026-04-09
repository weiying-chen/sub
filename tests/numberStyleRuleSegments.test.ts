import { describe, it, expect } from "vitest"

import { analyzeSegments } from "../src/analysis/segments"
import { numberStyleRule } from "../src/analysis/numberStyleRule"

describe("numberStyleRule (segments)", () => {
  it("flags digit/word violations and ignores sentence starts + time", () => {
    const segments = [
      { lineIndex: 1, translation: "This is 5 examples." },
      { lineIndex: 3, translation: "This is eleven examples." },
      { lineIndex: 5, translation: "Eleven examples start a sentence." },
      { lineIndex: 7, translation: "It happened at 3:30 yesterday." },
      { lineIndex: 9, translation: "We saw 12 birds." },
      { lineIndex: 11, translation: "12 birds landed." },
      { lineIndex: 13, translation: "Twenty two birds landed." },
      { lineIndex: 15, translation: "We raised 1,000 dollars." },
      { lineIndex: 16, translation: "If we can make it five-two-seven." },
      { lineIndex: 17, translation: "About 10,000 people attended." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, lineText: segment.translation },
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
      { lineIndex: 0, translation: "( 01/01 )", targetLines: [] },
      { lineIndex: 1, translation: "Metadata line.", targetLines: [] },
      { lineIndex: 2, translation: "( speaker )", targetLines: [] },
    ]

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores age adjectives like twelve-year-old", () => {
    const segments = [
      { lineIndex: 0, translation: "Twelve-year-old Alex went home." },
      { lineIndex: 1, translation: "She is a twelve year old student." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, lineText: segment.translation },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores currency amounts with symbols", () => {
    const segments = [
      { lineIndex: 0, translation: "It's about NT$1 million per bed." },
      { lineIndex: 1, translation: "The estimate is US$ 2 million total." },
      { lineIndex: 2, translation: "He paid $3 yesterday." },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, lineText: segment.translation },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores measurement abbreviations like kg", () => {
    const segments = [
      { lineIndex: 0, translation: "Each blanket weighed nearly 5 kg." },
      { lineIndex: 1, translation: "The load was 12 kg total." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores AM/PM time notation", () => {
    const segments = [
      { lineIndex: 0, translation: "The meeting starts at 3 PM." },
      { lineIndex: 1, translation: "Please arrive by 10 a.m." },
      { lineIndex: 2, translation: "The event ends at 11 PM." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores approximate quantity phrases like a few hundred", () => {
    const segments = [
      { lineIndex: 0, translation: "They donated a few hundred dollars." },
      { lineIndex: 1, translation: "Several hundred people attended." },
      { lineIndex: 2, translation: "Almost a hundred felt something on her left side---" },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores approximate number ranges like one or two hundred", () => {
    const segments = [
      { lineIndex: 0, translation: "I must have one or two hundred outfits." },
      { lineIndex: 1, translation: "They waited one or two thousand hours." },
      { lineIndex: 2, translation: "We need twenty or thirty chairs." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores decimal quantities like 8.47 years", () => {
    const segments = [
      { lineIndex: 0, translation: "People spend about 8.47 years in poor health." },
      { lineIndex: 1, translation: "The rate rose to 10.5 percent." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores measurement ranges with decimal endpoints", () => {
    const segments = [
      { lineIndex: 0, translation: "and measures over 0.5 to about 1 centimeter," },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores digit ranges in statistical age phrases", () => {
    const segments = [
      { lineIndex: 0, translation: "They are quite common among kids aged 3 to 17." },
      { lineIndex: 1, translation: "The survey covered children ages 3-17." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores statistical ratio phrases like three in a thousand", () => {
    const segments = [
      { lineIndex: 0, translation: "About three in a thousand babies have hearing loss." },
      { lineIndex: 1, translation: "About 3 in 1,000 babies have hearing loss." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("ignores coordinated numeric lists with a shared unit", () => {
    const segments = [
      { lineIndex: 0, translation: "with full evaluations at 6, 12, and 24 months." },
      { lineIndex: 1, translation: "follow-up visits at six, twelve, and twenty-four months." },
    ].map((segment) => ({
      ...segment,
      targetLines: [{ lineIndex: segment.lineIndex, lineText: segment.translation }],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    expect(findings).toHaveLength(0)
  })

  it("flags sentence-start digits across line-start wrappers", () => {
    const segments = [
      { lineIndex: 0, translation: "20 birds arrived." },
      { lineIndex: 1, translation: "(20 birds arrived.)" },
      { lineIndex: 2, translation: '"20 birds arrived."' },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, lineText: segment.translation },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")
    const flaggedLines = findings.map((f) => f.lineIndex).sort((a, b) => a - b)

    expect(flaggedLines).toEqual([0, 1, 2])
    expect(findings.every((f) => f.token === "20")).toBe(true)
    expect(findings.every((f) => f.found === "digits")).toBe(true)
    expect(findings.every((f) => f.expected === "words")).toBe(true)
  })

  it("treats leading double quote as continuation across timestamps", () => {
    const segments = [
      { lineIndex: 0, translation: '"We counted birds all morning' },
      { lineIndex: 1, translation: '"20 arrived near the lake."' },
    ].map((segment) => ({
      ...segment,
      targetLines: [
        { lineIndex: segment.lineIndex, lineText: segment.translation },
      ],
    }))

    const metrics = analyzeSegments(segments, [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    expect(findings).toHaveLength(0)
  })
})
