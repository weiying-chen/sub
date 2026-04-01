import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { createSubsSegmentRules } from "../src/analysis/subsSegmentRules"
import { getFindings } from "../src/shared/findings"

describe("timestampFormatRule (segments)", () => {
  it("flags malformed timestamp rows with unexpected leading characters", () => {
    const text = [
      "00:11:35:28\t00:11:37:04\t我如果犯錯",
      "\"If I mess up, I'm not good enough.\"",
      "00:11:37:04\t00:11:38:09\t我如果不夠乖",
      "\"If I mess up, I'm not good enough.\"",
      "\"00:11:38:09\t00:11:40:10\t我如果不夠完美",
      "\"If I'm not perfect, people will reject me.\"",
      "00:11:40:10\t00:11:43:21\t別人是會拒絕我的",
      "\"If I'm not perfect, people will reject me.\"",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(text, "subs", createSubsSegmentRules())
    )

    expect(
      findings.some(
        (finding) =>
          String(finding.type) === "TIMESTAMP_FORMAT" &&
          finding.lineIndex === 4
      )
    ).toBe(true)
  })

  it("allows valid timestamp rows with XXX prefix", () => {
    const text = [
      "XXX 00:11:35:28\t00:11:37:04\t我如果犯錯",
      "\"If I mess up, I'm not good enough.\"",
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
      "0:11:35:28\t00:11:37:04\t我如果犯錯",
      "\"If I mess up, I'm not good enough.\"",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(text, "subs", createSubsSegmentRules())
    )

    expect(
      findings.some((finding) => String(finding.type) === "TIMESTAMP_FORMAT")
    ).toBe(true)
  })
})
