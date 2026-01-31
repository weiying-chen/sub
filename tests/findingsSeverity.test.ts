import { describe, it, expect } from "vitest"

import { analyzeLines } from "../src/analysis/analyzeLines"
import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { baselineRule } from "../src/analysis/baselineRule"
import { capitalizationRule } from "../src/analysis/capitalizationRule"
import { cpsBalanceRule } from "../src/analysis/cpsBalanceRule"
import { cpsRule } from "../src/analysis/cpsRule"
import { maxCharsRule } from "../src/analysis/maxCharsRule"
import { numberStyleRule } from "../src/analysis/numberStyleRule"
import { percentStyleRule } from "../src/analysis/percentStyleRule"
import { punctuationRule } from "../src/analysis/punctuationRule"
import { getFindings } from "../src/shared/findings"

describe("getFindings severity", () => {
  it("marks non-warn findings as error (style + max chars)", () => {
    const numberText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This is 5 examples.",
    ].join("\n")
    const numberMetrics = analyzeTextByType(numberText, "subs", [
      numberStyleRule(),
    ])
    const numberFindings = getFindings(numberMetrics).filter(
      (m) => m.type === "NUMBER_STYLE"
    )
    expect(numberFindings[0]?.severity).toBe("error")

    const percentText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We saw 5 percent growth.",
    ].join("\n")
    const percentMetrics = analyzeTextByType(percentText, "subs", [
      percentStyleRule(),
    ])
    const percentFindings = getFindings(percentMetrics).filter(
      (m) => m.type === "PERCENT_STYLE"
    )
    expect(percentFindings[0]?.severity).toBe("error")

    const capText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "openai released a model.",
    ].join("\n")
    const capMetrics = analyzeTextByType(capText, "subs", [
      capitalizationRule({ terms: ["OpenAI"] }),
    ])
    const capFindings = getFindings(capMetrics).filter(
      (m) => m.type === "CAPITALIZATION"
    )
    expect(capFindings[0]?.severity).toBe("error")

    const longText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This line is too long.",
    ].join("\n")
    const maxCharsMetrics = analyzeTextByType(longText, "subs", [
      maxCharsRule(5),
    ])
    const maxCharsFindings = getFindings(maxCharsMetrics).filter(
      (m) => m.type === "MAX_CHARS"
    )
    expect(maxCharsFindings[0]?.severity).toBe("error")
  })

  it("marks punctuation findings as error", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "this should be capitalized.",
    ].join("\n")
    const metrics = analyzeTextByType(text, "subs", [punctuationRule()])
    const findings = getFindings(metrics).filter(
      (m) => m.type === "PUNCTUATION"
    )
    expect(findings[0]?.severity).toBe("error")
  })

  it("marks baseline findings as error", () => {
    const baseline = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "00:00:02:00\t00:00:03:00\tSRC2",
    ].join("\n")
    const current = "00:00:01:00\t00:00:02:00\tSRC1"
    const metrics = analyzeLines(current, [baselineRule(baseline)])
    const findings = getFindings(metrics).filter(
      (m) => m.type === "BASELINE"
    )
    expect(findings[0]?.severity).toBe("error")
  })

  it("marks CPS findings as warn", () => {
    const text = [
      "00:00:01:00\t00:00:03:00\tMarker",
      "Hi",
      "00:00:03:00\t00:00:04:00\tMarker",
      "This is a very long line.",
    ].join("\n")

    const cpsMetrics = analyzeTextByType(text, "subs", [cpsRule(17, 10)])
    const cpsFindings = getFindings(cpsMetrics).filter(
      (m) => m.type === "MIN_CPS"
    )
    expect(cpsFindings[0]?.severity).toBe("warn")

    const balanceMetrics = analyzeTextByType(text, "subs", [cpsBalanceRule()])
    const balanceFindings = getFindings(balanceMetrics).filter(
      (m) => m.type === "CPS_BALANCE"
    )
    expect(balanceFindings[0]?.severity).toBe("warn")
  })
})
