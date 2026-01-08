import { describe, it, expect } from "vitest"

import { analyzeLines } from "../src/analysis/analyzeLines"
import { punctuationRule, punctuationRuleWithOptions } from "../src/analysis/punctuationRule"

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

    const ruleCodes = findings.map((f) => f.ruleCode).sort()
    expect(ruleCodes).toEqual([
      "LOWERCASE_AFTER_PERIOD",
      "MISSING_CLOSING_QUOTE",
      "MISSING_COLON_BEFORE_QUOTE",
      "MISSING_END_PUNCTUATION",
      "MISSING_PUNCTUATION_BEFORE_CAPITAL",
    ])

    const byRuleCode = new Map(findings.map((f) => [f.ruleCode, f]))
    expect(byRuleCode.get("LOWERCASE_AFTER_PERIOD")?.text).toBe(
      "this should be capitalized."
    )
    expect(byRuleCode.get("MISSING_PUNCTUATION_BEFORE_CAPITAL")?.text).toBe(
      "This continues"
    )
    expect(byRuleCode.get("MISSING_COLON_BEFORE_QUOTE")?.text).toBe("He said")
    expect(byRuleCode.get("MISSING_END_PUNCTUATION")?.text).toBe(
      "This line lacks terminal"
    )
    expect(byRuleCode.get("MISSING_CLOSING_QUOTE")?.text).toBe("\"Unclosed.")
  })

  it("ignores acronyms starting the next cue", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "He missed his first choice,",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "NTU's Department of Economics.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("ignores configured proper nouns starting the next cue", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "He was always listening to",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "English stories or songs.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [
      punctuationRuleWithOptions({ properNouns: ["English"] }),
    ])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("flags dangling closing quote", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This ends with a dangling quote.\"",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings.some((f) => f.ruleCode === "MISSING_OPENING_QUOTE")).toBe(
      true
    )
  })

  it("flags missing opening quote when quoted speech continues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "\"it makes me feel like not knowing my way\"",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "means there's something wrong with me.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "MISSING_OPENING_QUOTE_CONTINUATION")
    ).toBe(true)
  })

  it("does not require ':' when the next quoted line is a continuation", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "\"it makes me feel like not knowing my way\"",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"means there's something wrong with me.\"",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "MISSING_COLON_BEFORE_QUOTE")
    ).toBe(false)
  })

  it('flags unclosed opening quote even when it is mid-line', () => {
    const text = [
      '00:00:01:00\t00:00:02:00\tMarker',
      'He said, "hello.',
      '',
    ].join('\n')

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === 'PUNCTUATION')

    expect(findings.some((f) => f.ruleCode === 'MISSING_CLOSING_QUOTE')).toBe(
      true
    )
  })

  it('flags dangling closing quote even when it is mid-line', () => {
    const text = [
      '00:00:01:00\t00:00:02:00\tMarker',
      'He said hello".',
      '',
    ].join('\n')

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === 'PUNCTUATION')

    expect(findings.some((f) => f.ruleCode === 'MISSING_OPENING_QUOTE')).toBe(
      true
    )
  })
})
