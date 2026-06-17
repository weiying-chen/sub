import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { repeatedPunctuationRule } from "../src/analysis/repeatedPunctuationRule"

describe("repeatedPunctuationRule", () => {
  it("flags repeated punctuation in subtitle text", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Before him,, Hu Yu-zhu was the one",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [repeatedPunctuationRule()])
    const findings = metrics.filter((m) => m.type === "REPEATED_PUNCTUATION")

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "REPEATED_PUNCTUATION",
      lineIndex: 1,
      token: ",,",
      text: "Before him,, Hu Yu-zhu was the one",
    })
  })

  it("does not flag ellipses", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "I was thinking...",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [repeatedPunctuationRule()])
    const findings = metrics.filter((m) => m.type === "REPEATED_PUNCTUATION")

    expect(findings).toHaveLength(0)
  })
})
