import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { createSubsSegmentRules } from "../src/analysis/subsSegmentRules"
import { getFindings } from "../src/shared/findings"

describe("timestampFormatRule (segments)", () => {
  it("flags malformed timestamp rows with unexpected leading characters", () => {
    const text = [
      "00:00:01:00\t00:00:02:10\t來源文字一",
      "\"Hello world.\"",
      "00:00:02:10\t00:00:03:20\t來源文字二",
      "\"Hello world.\"",
      "\"00:00:03:20\t00:00:04:15\t來源文字三",
      "\"Second line.\"",
      "00:00:04:15\t00:00:05:25\t來源文字四",
      "\"Second line.\"",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(text, "subs", createSubsSegmentRules())
    )

    expect(
      findings.some(
        (finding) =>
          String(finding.type) === "TIMESTAMP_FORMAT" &&
          finding.lineIndex === 4 &&
          finding.text.includes("\"00:00:03:20")
      )
    ).toBe(true)
  })

  it("allows valid timestamp rows with XXX prefix", () => {
    const text = [
      "XXX 00:00:01:00\t00:00:02:00\tSource text",
      "\"Hello world.\"",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(text, "subs", createSubsSegmentRules())
    )

    expect(
      findings.some((finding) => String(finding.type) === "TIMESTAMP_FORMAT")
    ).toBe(false)
  })

  it("flags timestamp rows with missing leading zero", () => {
    const text = [
      "0:00:01:00\t00:00:02:00\tSource text",
      "\"Hello world.\"",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(text, "subs", createSubsSegmentRules())
    )

    expect(
      findings.some((finding) => String(finding.type) === "TIMESTAMP_FORMAT")
    ).toBe(true)
  })
})
