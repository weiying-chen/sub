import { describe, expect, it } from "vitest"

import { buildAnalysisOutput } from "../src/analysis/buildAnalysisOutput"

describe("news super final period rule", () => {
  it("flags a period at the end of the last SUPER line", () => {
    const text = [
      "/*SUPER:",
      "慈濟志工｜蔡岱霖//",
      "都會說感恩 感恩",
      "*/",
      "Volunteer",
      "Tzu Chi Foundation.",
      "",
    ].join("\n")

    const findings = buildAnalysisOutput({
      text,
      type: "news",
      ruleSet: "findings",
      output: "findings",
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SUPER_END_PERIOD",
          lineIndex: 5,
          text: "Tzu Chi Foundation.",
        }),
      ])
    )
  })

  it("checks the last SUPER line instead of an earlier wrapped line", () => {
    const text = [
      "/*SUPER:",
      "慈濟志工｜蔡岱霖//",
      "都會說感恩 感恩",
      "*/",
      "(Clear Heat and Dampness to.)",
      "(Reduce Inflammation)",
      "",
    ].join("\n")

    const findings = buildAnalysisOutput({
      text,
      type: "news",
      ruleSet: "findings",
      output: "findings",
    })

    expect(findings).toEqual([])
  })
})
