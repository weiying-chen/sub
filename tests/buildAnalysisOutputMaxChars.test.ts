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

  it("uses stricter default maxChars for news than subs", () => {
    const text = [
      "/*SUPER:",
      "*/",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ].join("\n")

    const subsFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CHARS"],
    }) as Finding[]

    const newsFindings = buildAnalysisOutput({
      text,
      type: "news",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CHARS"],
    }) as Finding[]

    expect(subsFindings.some((f) => f.type === "MAX_CHARS")).toBe(false)
    expect(newsFindings.some((f) => f.type === "MAX_CHARS")).toBe(true)
  })
})

describe("buildAnalysisOutput CPS overrides", () => {
  it("uses custom maxCps for subs findings", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "123456789",
    ].join("\n")

    const defaultFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CPS"],
    }) as Finding[]

    const strictFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MAX_CPS"],
      maxCps: 8,
    }) as Finding[]

    expect(defaultFindings.some((f) => f.type === "MAX_CPS")).toBe(false)
    expect(strictFindings.some((f) => f.type === "MAX_CPS")).toBe(true)
  })

  it("uses custom minCps for subs findings", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "12",
    ].join("\n")

    const defaultFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MIN_CPS"],
    }) as Finding[]

    const relaxedFindings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["MIN_CPS"],
      minCps: 1,
    }) as Finding[]

    expect(defaultFindings.some((f) => f.type === "MIN_CPS")).toBe(true)
    expect(relaxedFindings.some((f) => f.type === "MIN_CPS")).toBe(false)
  })

  it("does not flag punctuation-before-capital for capitalization terms", () => {
    const text = [
      "00:06:38:29\t00:06:40:07\t我先幫她潤肺",
      "So I used Chinese angelica, astragalus root,",
      "00:06:40:07\t00:06:41:25\t然後幫她活血化瘀",
      "Japanese honeysuckle, and scrophularia root to",
    ].join("\n")

    const findings = buildAnalysisOutput({
      text,
      type: "subs",
      ruleSet: "findings",
      output: "findings",
      enabledRuleTypes: ["PUNCTUATION"],
      capitalizationTerms: ["Japanese"],
      properNouns: [],
    }) as Finding[]

    expect(
      findings.some(
        (f) =>
          f.type === "PUNCTUATION" &&
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL"
      )
    ).toBe(false)
  })
})
