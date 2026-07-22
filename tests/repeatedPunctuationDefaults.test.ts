import { describe, expect, it } from "vitest"

import { runAnalysis } from "../src/cli/runAnalysis"
import type { Metric } from "../src/analysis/types"

describe("repeated punctuation defaults", () => {
  it("finds repeated punctuation across adjacent subtitle cues", async () => {
    const subsText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "What happened?",
      "00:00:02:00\t00:00:03:00\tMarker",
      "? I couldn't tell.",
    ].join("\n")

    const output = (await runAnalysis(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output).toContainEqual(
      expect.objectContaining({
        type: "REPEATED_PUNCTUATION",
        lineIndex: 3,
        index: 0,
        token: "??",
      })
    )
  })

  it("includes repeated-punctuation findings by default in subs, news, and text", async () => {
    const subsText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Before him,, Hu Yu-zhu was the one",
    ].join("\n")
    const newsText = [
      "VO:",
      "Before him,, Hu Yu-zhu was the one",
    ].join("\n")
    const plainText = "Before him,, Hu Yu-zhu was the one"

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
      "REPEATED_PUNCTUATION"
    )
    expect(newsOutput.map((metric) => String(metric.type))).toContain(
      "REPEATED_PUNCTUATION"
    )
    expect(textOutput.map((metric) => String(metric.type))).toContain(
      "REPEATED_PUNCTUATION"
    )
  })
})
