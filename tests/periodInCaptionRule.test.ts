import { describe, expect, it } from "vitest"

import { buildAnalysisOutput } from "../src/analysis/buildAnalysisOutput"

describe("period in caption rule", () => {
  it("flags a period at the end of a subs caption", () => {
    const text = [
      "00:01:10:05\t00:01:15:21\t篤定了跟著師父行菩薩道",
      "(She'd follow me on the Bodhisattva Path.)",
    ].join("\n")

    const findings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "PERIOD_IN_CAPTION",
          lineIndex: 1,
          text: "(She'd follow me on the Bodhisattva Path.)",
        }),
      ])
    )
  })

  it("flags a period at the end of a news SUPER caption", () => {
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
          type: "PERIOD_IN_CAPTION",
          lineIndex: 5,
          text: "Tzu Chi Foundation.",
        }),
      ])
    )
  })

  it("flags a period at the end of a text caption", () => {
    const text = "Volunteer Tzu Chi Foundation."

    const findings = buildAnalysisOutput({
      text,
      type: "text",
      ruleSet: "findings",
      output: "findings",
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "PERIOD_IN_CAPTION",
          lineIndex: 0,
          text: "Volunteer Tzu Chi Foundation.",
        }),
      ])
    )
  })
})
