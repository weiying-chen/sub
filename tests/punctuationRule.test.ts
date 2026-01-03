import { describe, it, expect } from "vitest"

import { analyzeLines } from "../src/analysis/analyzeLines"
import { punctuationRule } from "../src/analysis/punctuationRule"

describe("punctuationRule", () => {
  it("flags punctuation/capitalization issues between subtitle cues", () => {
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

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    const ruleIds = findings.map((f) => f.ruleId).sort((a, b) => a - b)
    expect(ruleIds).toEqual([1, 2, 3, 4, 5])

    const byRuleId = new Map(findings.map((f) => [f.ruleId, f]))
    expect(byRuleId.get(1)?.text).toBe("this should be capitalized.")
    expect(byRuleId.get(2)?.text).toBe("This continues")
    expect(byRuleId.get(3)?.text).toBe("He said")
    expect(byRuleId.get(4)?.text).toBe("This line lacks terminal")
    expect(byRuleId.get(5)?.text).toBe("\"Unclosed.")
  })
})
