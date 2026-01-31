import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { leadingWhitespaceRule } from "../src/analysis/leadingWhitespaceRule"

describe("leadingWhitespaceRule (segments)", () => {
  it("flags leading whitespace in payload lines", () => {
    const text = [
      "00:00:10:00\t00:00:11:00\tGap text",
      " Gap text",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [leadingWhitespaceRule()])
    const findings = metrics.filter((m) => m.type === "LEADING_WHITESPACE")

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      type: "LEADING_WHITESPACE",
      lineIndex: 1,
      count: 1,
      text: " Gap text",
    })
  })

  it("ignores lines without leading whitespace", () => {
    const text = [
      "00:00:10:00\t00:00:11:00\tGap text",
      "Gap text",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [leadingWhitespaceRule()])
    const findings = metrics.filter((m) => m.type === "LEADING_WHITESPACE")
    expect(findings).toHaveLength(0)
  })
})
