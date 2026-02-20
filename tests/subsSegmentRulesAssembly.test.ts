import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { createSubsSegmentRules } from "../src/analysis/subsSegmentRules"
import { getFindings } from "../src/shared/findings"

describe("createSubsSegmentRules", () => {
  it("can restrict execution to selected finding types", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This is 5 examples.",
    ].join("\n")

    const allMetrics = analyzeTextByType(text, "subs", createSubsSegmentRules())
    expect(allMetrics.some((metric) => metric.type === "MAX_CHARS")).toBe(true)
    expect(allMetrics.some((metric) => metric.type === "NUMBER_STYLE")).toBe(true)

    const filteredMetrics = analyzeTextByType(
      text,
      "subs",
      createSubsSegmentRules({
        enabledFindingTypes: ["NUMBER_STYLE"],
      })
    )

    expect(filteredMetrics).toHaveLength(1)
    expect(filteredMetrics.map((metric) => metric.type)).toEqual(["NUMBER_STYLE"])
  })

  it("keeps cps rule active when either MAX_CPS or MIN_CPS is enabled", () => {
    const text = [
      "00:00:01:00\t00:00:03:00\tMarker",
      "Hi",
      "",
      "00:00:03:00\t00:00:04:00\tMarker",
      "This payload is definitely too long for one second.",
    ].join("\n")

    const maxOnlyFindings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["MAX_CPS"],
        })
      )
    )
    expect(maxOnlyFindings.some((finding) => finding.type === "MAX_CPS")).toBe(true)
    expect(maxOnlyFindings.some((finding) => finding.type === "MIN_CPS")).toBe(true)
    expect(maxOnlyFindings.some((finding) => finding.type === "CPS_BALANCE")).toBe(false)
  })
})
