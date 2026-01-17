import { describe, it, expect } from "vitest"

import type { Metric } from "../src/analysis/types"
import { buildMetricsOutput } from "../src/cli/metrics"

describe("metrics CLI output", () => {
  it("returns MAX_CHARS metrics for news SUPER lines", async () => {
    const text = [
      "Intro line.",
      "/*SUPER:",
      "super meta line",
      "*/",
      "Short line.",
      "Another line.",
      "",
      "VO line.",
    ].join("\n")

    const output = (await buildMetricsOutput(text, {
      type: "news",
    })) as Metric[]

    const maxChars = output.filter((metric) => metric.type === "MAX_CHARS")
    expect(maxChars.map((metric) => metric.lineIndex)).toEqual([4, 5])
  })

  it("filters subs metrics by rule type", async () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Short line.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Another line.",
    ].join("\n")

    const output = (await buildMetricsOutput(text, {
      type: "subs",
      ruleFilters: ["MAX_CHARS"],
    })) as Metric[]

    expect(output).toHaveLength(2)
    expect(output.map((metric) => metric.type)).toEqual([
      "MAX_CHARS",
      "MAX_CHARS",
    ])
    expect(output.map((metric) => metric.lineIndex)).toEqual([1, 3])
  })
})
