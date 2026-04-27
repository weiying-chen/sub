import { describe, it, expect } from "vitest"

import { analyzeLines } from "../src/analysis/analyzeLines"
import { punctuationRule } from "../src/analysis/punctuationRule"

describe("punctuationRule", () => {
  it("flags punctuation/capitalization issues between subtitle cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "this should be capitalized.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "This continues",
      "00:00:04:00\t00:00:05:00\tMarker",
      "Next Starts Capital.",
      "00:00:05:00\t00:00:06:00\tMarker",
      "He said,",
      "00:00:06:00\t00:00:07:00\tMarker",
      "\"Hello there.\"",
      "00:00:07:00\t00:00:08:00\tMarker",
      "\"Unclosed.",
      "00:00:08:00\t00:00:09:00\tMarker",
      "This line lacks terminal",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    const ruleCodes = findings.map((f) => f.ruleCode).sort()
    expect(ruleCodes).toEqual([
      "COMMA_BEFORE_QUOTE",
      "LOWERCASE_AFTER_PERIOD",
      "MISSING_CLOSING_QUOTE",
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
    expect(byRuleCode.get("COMMA_BEFORE_QUOTE")?.text).toBe("He said,")
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

  it("ignores acronym plurals starting the next cue", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "According to U.S. statistics,",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "NDDs and cognitive disabilities.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("ignores lowercase continuation after abbreviation-ending cue text", () => {
    const text = [
      "00:18:51:00\t00:18:52:04\tMarker",
      "A top expert in developmental delays in the U.S.",
      "00:18:52:04\t00:18:54:25\tMarker",
      "A top expert in developmental delays in the U.S.",
      "00:18:54:25\t00:18:56:15\tMarker",
      "once said the real therapy happens between visits,",
      "00:18:56:15\t00:18:59:00\tMarker",
      "once said the real therapy happens between visits,",
      "00:18:59:00\t00:18:59:20\tMarker",
      "not in squeezing in five sessions a week.",
      "00:18:59:20\t00:19:01:27\tMarker",
      "not in squeezing in five sessions a week.",
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
      punctuationRule({ properNouns: ["English"] }),
    ])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("ignores configured proper nouns that end with punctuation", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "He was speaking to",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Mr. Chen at the gate.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [
      punctuationRule({ properNouns: ["Mr."] }),
    ])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("does not flag missing punctuation before capital for hyphenated romanized Chinese names", () => {
    const text = [
      "00:08:09:12\t00:08:12:22\t第二次見面華萱告訴我",
      "The second time we met,",
      "00:08:12:22\t00:08:15:05\t其實我是不怕死的",
      "Hua-xuan said she wasn't afraid of dying---",
      "00:08:15:05\t00:08:17:16\t比較擔心的是我的家人",
      "Hua-xuan said she wasn't afraid of dying---",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) => f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL"
      )
    ).toBe(false)
  })

  it("does not flag missing punctuation before capital for A-prefix romanized names", () => {
    const text = [
      "00:09:37:09\t00:09:39:22\t因為緣分不足",
      "But unfortunately, it just wasn't meant to be---",
      "00:09:39:22\t00:09:42:11\t婆婆就是不喜歡阿布",
      "A Guang's mother didn't like A Bu,",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) => f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL"
      )
    ).toBe(false)
  })

  it("checks across empty lines between cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello.",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "this should be capitalized.",
      "",
      "00:00:03:00\t00:00:04:00\tMarker",
      "He said,",
      "",
      "00:00:04:00\t00:00:05:00\tMarker",
      "\"Hello there.\"",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "LOWERCASE_AFTER_PERIOD")
    ).toBe(true)
    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(true)
  })

  it("flags uppercase continuation after triple hyphen", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "But it only pushed him farther and farther away---",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Until we ended up completely apart.",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "But it only pushed him farther and farther away---"
        )
    ).toBe(true)
  })

  it("flags uppercase continuation after em dash", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "But it only pushed him farther and farther away—",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Until we ended up completely apart.",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "But it only pushed him farther and farther away—"
      )
    ).toBe(true)
  })

  it("does not compare across non-empty metadata lines between cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello",
      "https://example.com/source",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Next Starts Capital.",
      "",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL")
    ).toBe(false)
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

  it("does not require ':' when the next quoted line is a continuation", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "\"it makes me feel like not knowing my way\"",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"means there's something wrong with me.\"",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(false)
  })

  it("does not require ':' before a quoted line when the previous line has no comma", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This phrase introduces",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"a quoted term.\"",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(false)
  })

  it("requires ':' only when a comma introduces the next quoted line", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "He said,",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"Hello there.\"",
    ].join("\n")

    const metrics = analyzeLines(text, [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(true)
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
