import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { analyzeSegments, parseSubs } from "../src/analysis/segments"
import { punctuationRule } from "../src/analysis/punctuationRule"

describe("punctuationRule (segments)", () => {
  it("flags punctuation/capitalization issues across parsed cues", () => {
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    const ruleCodes = findings.map((f) => f.ruleCode).sort()
    expect(ruleCodes).toEqual([
      "COMMA_BEFORE_QUOTE",
      "LOWERCASE_AFTER_PERIOD",
      "MISSING_CLOSING_QUOTE",
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

  it("ignores acronym plurals starting the next cue", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "According to U.S. statistics,",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "NDDs and cognitive disabilities.",
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("flags across blank separators between cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "continues here",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Next Sentence Starts.",
      "",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "continues here"
      )
    ).toBe(true)
  })

  it("does not compare across non-empty metadata lines between cues", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "continues here",
      "https://example.com/source",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Next Sentence Starts.",
      "",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "continues here"
      )
    ).toBe(false)
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

    expect(findings.some((f) => f.ruleCode === "MISSING_OPENING_QUOTE")).toBe(
      true
    )
  })

  it("treats em dash and triple hyphen as terminal punctuation", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Isn't there a saying---",
      "00:00:02:00\t00:00:03:00\tMarker",
      "When you've been doing something long enough,",
      "00:00:03:00\t00:00:04:00\tMarker",
      "He paused —",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    const missingBeforeCapital = findings.filter(
      (f) => f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL"
    )
    const missingEnd = findings.filter(
      (f) => f.ruleCode === "MISSING_END_PUNCTUATION"
    )
    expect(
      missingEnd.some((f) => f.text === "He paused —")
    ).toBe(false)
  })

  it("flags uppercase continuation after triple hyphen", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "But it only pushed him farther and farther away---",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Until we ended up completely apart.",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "But it only pushed him farther and farther away—"
      )
    ).toBe(true)
  })

  it("does not require ':' when the next quoted line is a continuation", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "\"it makes me feel like not knowing my way\"",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"means there's something wrong with me.\"",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(false)
  })

  it("does not require ':' before continuation quoted cues across timestamps", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "\"This quote starts here",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"and continues to here.\"",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(false)
  })

  it("flags missing punctuation before capital for consecutive standalone quoted cues", () => {
    const text = [
      "00:16:43:09\t00:16:44:09\tMarker",
      "\"One time,\"",
      "00:16:44:09\t00:16:45:15\tMarker",
      "\"A friend called to ask if I wanted tea.\"",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "\"One time,\""
      )
    ).toBe(true)
  })

  it("does not flag missing punctuation before capital when quoted next cue starts with I pronoun", () => {
    const text = [
      "00:06:32:16\t00:06:34:13\tMarker",
      "\"But not too much---\"",
      "00:06:34:13\t00:06:36:28\tMarker",
      "\"I don't want us to start fighting again.\"",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "\"But not too much---\""
      )
    ).toBe(false)
  })

  it("does not require ':' for non-comma lead-ins before quoted cues across timestamps", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This phrase introduces",
      "00:00:02:00\t00:00:03:00\tMarker",
      "\"a quoted term.\"",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some((f) => f.ruleCode === "COMMA_BEFORE_QUOTE")
    ).toBe(false)
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

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split('\n'),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === 'PUNCTUATION')

    expect(findings.some((f) => f.ruleCode === 'MISSING_OPENING_QUOTE')).toBe(
      true
    )
  })

  it("does not analyze timestamp-row source text", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tThis source line lacks punctuation",
      "This translation is clean.",
      "00:00:02:00\t00:00:03:00\tAnother Source Starts Capital",
      "This translation is also clean.",
    ].join("\n")

    const segments = parseSubs(text)
    const metrics = analyzeSegments(segments, [punctuationRule()], {
      lines: text.split("\n"),
      sourceText: text,
    })
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(findings).toHaveLength(0)
  })

  it("checks punctuation continuity in text mode without timestamps", () => {
    const text = [
      "First sentence without ending",
      "Second Sentence starts with capital.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "text", [punctuationRule()])
    const findings = metrics.filter((m) => m.type === "PUNCTUATION")

    expect(
      findings.some(
        (f) =>
          f.ruleCode === "MISSING_PUNCTUATION_BEFORE_CAPITAL" &&
          f.text === "First sentence without ending"
      )
    ).toBe(true)
  })
})
