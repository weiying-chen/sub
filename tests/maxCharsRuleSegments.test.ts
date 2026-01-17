import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { maxCharsRule } from "../src/analysis/maxCharsRule"

describe("maxCharsRule (segments)", () => {
  it("anchors to payload line indices when parsing subs", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Short",
      "00:00:02:00\t00:00:03:00\tMarker",
      "This is long",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [maxCharsRule(10)])

    expect(metrics).toHaveLength(2)

    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    expect(byLine.get(1)?.actual).toBe(5)
    expect(byLine.get(3)?.actual).toBe(12)
  })

  it("applies to SUPER lines when parsing news", () => {
    const text = [
      "Intro line ignored.",
      "/*SUPER:",
      "字幕中文。",
      "*/",
      "Short line.",
      "This line is definitely too long.",
      "",
      "VO line stays unchecked.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [maxCharsRule(12)])

    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    expect(byLine.get(4)?.actual).toBe(11)
    expect(byLine.get(5)?.actual).toBe(33)
    expect(byLine.has(7)).toBe(false)
  })
})
