import { describe, expect, it } from "vitest"

import { buildAnalyzeOutput } from "../src/cli/analyzeOutput"
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

    const subsOutput = (await buildAnalyzeOutput(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]
    const newsOutput = (await buildAnalyzeOutput(newsText, {
      type: "news",
      mode: "findings",
    })) as Metric[]
    const textOutput = (await buildAnalyzeOutput(plainText, {
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
