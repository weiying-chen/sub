import { describe, expect, it } from "vitest"

import { runAnalysis } from "../src/cli/runAnalysis"
import type { Metric } from "../src/analysis/types"

describe("repeated word defaults", () => {
  it("includes repeated-word findings by default in subs, news, and text", async () => {
    const subsText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We can can fix this.",
    ].join("\n")
    const newsText = [
      "VO:",
      "We can can fix this.",
    ].join("\n")
    const plainText = "We can can fix this."

    const subsOutput = (await runAnalysis(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]
    const newsOutput = (await runAnalysis(newsText, {
      type: "news",
      mode: "findings",
    })) as Metric[]
    const textOutput = (await runAnalysis(plainText, {
      type: "text",
      mode: "findings",
    })) as Metric[]

    expect(subsOutput.map((metric) => String(metric.type))).toContain(
      "REPEATED_WORD"
    )
    expect(newsOutput.map((metric) => String(metric.type))).toContain(
      "REPEATED_WORD"
    )
    expect(textOutput.map((metric) => String(metric.type))).toContain(
      "REPEATED_WORD"
    )
  })
})
