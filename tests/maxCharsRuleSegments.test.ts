import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { maxCharsRule } from "../src/analysis/maxCharsRule"

describe("maxCharsRule (segments)", () => {
  it("anchors to translation line indices when parsing subs", () => {
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

  it("checks any news segment it is directly applied to", () => {
    const text = [
      "Intro line ignored.",
      "/*SUPER:",
      "super meta line",
      "*/",
      "Short line.",
      "This line is definitely too long.",
      "",
      "VO line stays unchecked.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [maxCharsRule(12)])

    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    expect(byLine.get(0)?.actual).toBe(19)
    expect(byLine.get(4)?.actual).toBe(11)
    expect(byLine.get(5)?.actual).toBe(33)
    expect(byLine.get(7)?.actual).toBe(24)
  })

  it("checks each translation line in a multi-line subtitle block", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "12345678901",
      "1234",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [maxCharsRule(10)])
    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))

    expect(byLine.get(1)?.actual).toBe(11)
    expect(byLine.get(2)?.actual).toBe(4)
  })

  it("still checks max chars for parenthetical subtitle blocks", () => {
    const text = [
      "00:00:20:00\t00:00:26:00\t黃崑祥72歲 許小鳳66歲 x 9歲黃靖媗",
      "(Huang Kun-xiang and Xu Xiao-feng and their granddaughter.)",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [maxCharsRule(54)])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "MAX_CHARS",
      lineIndex: 1,
      actual: 59,
      maxAllowed: 54,
    })
  })
})
