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

    const ruleIds = findings.map((f) => f.ruleId).sort()
    expect(ruleIds).toEqual([
      "LOWERCASE_AFTER_PERIOD",
      "MISSING_CLOSING_QUOTE",
      "MISSING_COLON_BEFORE_QUOTE",
      "MISSING_END_PUNCTUATION",
      "MISSING_PUNCTUATION_BEFORE_CAPITAL",
    ])
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("flags dangling closing quote", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This ends with a dangling quote.\"",
      "",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings.some((f) => f.ruleId === "MISSING_OPENING_QUOTE")).toBe(true)
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleId === "MISSING_OPENING_QUOTE_CONTINUATION")
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings.some((f) => f.ruleId === "MISSING_COLON_BEFORE_QUOTE")).toBe(
      false
    )
  })

  it('flags unclosed opening quote even when it is mid-line', () => {
    const text = [
      '00:00:01:00\t00:00:02:00\tMarker',
      'He said, "hello.',
      '',
    ].join('\n')

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split('\n'),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === 'PUNCTUATION')

    expect(findings.some((f) => f.ruleId === 'MISSING_CLOSING_QUOTE')).toBe(true)
  })

  it('flags dangling closing quote even when it is mid-line', () => {
    const text = [
      '00:00:01:00\t00:00:02:00\tMarker',
      'He said hello".',
      '',
    ].join('\n')

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split('\n'),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === 'PUNCTUATION')

    expect(findings.some((f) => f.ruleId === 'MISSING_OPENING_QUOTE')).toBe(true)
  })
})
