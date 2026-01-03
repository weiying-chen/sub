import { describe, it, expect } from "vitest"

import { analyzeSegments, parseSubs } from "../src/analysis/segments"
import { punctuationRule } from "../src/analysis/punctuationRule"

describe("punctuationRule (segments)", () => {
  it("flags punctuation/capitalization issues across parsed cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello.",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "this should be capitalized.",
      "",
      "00:00:03:00\t00:00:04:00\tMarker",
      "This continues",
      "",
      "00:00:04:00\t00:00:05:00\tMarker",
      "Next Starts Capital.",
      "",
      "00:00:05:00\t00:00:06:00\tMarker",
      "He said",
      "",
      "00:00:06:00\t00:00:07:00\tMarker",
      "\"Hello there.\"",
      "",
      "00:00:07:00\t00:00:08:00\tMarker",
      "\"Unclosed.",
      "",
      "00:00:08:00\t00:00:09:00\tMarker",
      "This line lacks terminal",
      "",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    const ruleIds = findings.map((f) => f.ruleId).sort((a, b) => a - b)
    expect(ruleIds).toEqual([1, 2, 3, 4, 5])
  })
})
