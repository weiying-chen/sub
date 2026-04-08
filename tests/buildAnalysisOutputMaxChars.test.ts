import { describe, expect, it } from "vitest"

import { buildAnalysisOutput } from "../src/analysis/buildAnalysisOutput"
import type { Finding } from "../src/analysis/types"

describe("buildAnalysisOutput maxChars override", () => {
  it("uses custom maxChars for subs findings", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "12345",
    ].join("\n")

    const strictFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CHARS"],
      maxChars: 4,
    }) as Finding[]

    const relaxedFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CHARS"],
      maxChars: 10,
    }) as Finding[]

    expect(strictFindings.some((f) => f.type === "MAX_CHARS")).toBe(true)
    expect(relaxedFindings.some((f) => f.type === "MAX_CHARS")).toBe(false)
  })
})
