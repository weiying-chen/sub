import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { quoteStyleRule } from "../src/analysis/quoteStyleRule"

describe("quoteStyleRule", () => {
  it("flags curly apostrophes in subs text", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "I can’t do that.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [quoteStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "QUOTE_STYLE",
      lineIndex: 1,
      token: "’",
    })
  })

  it("flags curly double quotes in news text", () => {
    const text = [
      "VO:",
      "He said “hello” to everyone.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [quoteStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "QUOTE_STYLE",
      lineIndex: 1,
      token: "“",
    })
  })

  it("flags curly apostrophes in text mode", () => {
    const text = "That’s not plain ASCII quotes."
    const metrics = analyzeTextByType(text, "text", [quoteStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "QUOTE_STYLE",
      lineIndex: 0,
      token: "’",
    })
  })

  it("does not flag straight quotes", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "He said \"hello\" and can't stay.",
    ].join("\n")
    const metrics = analyzeTextByType(text, "subs", [quoteStyleRule()])
    expect(metrics).toHaveLength(0)
  })
})
