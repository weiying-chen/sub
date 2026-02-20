import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import {
  createSubsMetricsRules,
  createSubsSegmentRules,
} from "../src/analysis/subsSegmentRules"
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

  it("keeps only the selected cps rule active", () => {
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
    expect(maxOnlyFindings.some((finding) => finding.type === "MIN_CPS")).toBe(false)
    expect(maxOnlyFindings.some((finding) => finding.type === "CPS_BALANCE")).toBe(false)
  })

  it("uses raw CPS metrics assembly for metrics mode", () => {
    const text = [
      "00:00:01:00\t00:00:03:00\tMarker",
      "Hi",
    ].join("\n")

    const metrics = analyzeTextByType(
      text,
      "subs",
      createSubsMetricsRules({
        enabledFindingTypes: ["MAX_CPS"],
      })
    )

    expect(metrics).toHaveLength(1)
    expect(metrics[0]?.type).toBe("CPS")
  })
})
