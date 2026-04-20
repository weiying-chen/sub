import { describe, expect, it } from "vitest"

import { buildAnalyzeOutput } from "../src/cli/analyzeOutput"
import type { Metric } from "../src/analysis/types"

describe("curly quotes defaults", () => {
  it("includes curly quotes findings by default in subs, news, and text", async () => {
    const subsText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "I can’t do that.",
    ].join("\n")
    const newsText = [
      "VO:",
      "He said “hello” to everyone.",
    ].join("\n")
    const plainText = "That’s not plain ASCII quotes."

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

    expect(subsOutput.map((metric) => String(metric.type))).toContain("QUOTE_STYLE")
    expect(newsOutput.map((metric) => String(metric.type))).toContain("QUOTE_STYLE")
    expect(textOutput.map((metric) => String(metric.type))).toContain("QUOTE_STYLE")
  })
})
