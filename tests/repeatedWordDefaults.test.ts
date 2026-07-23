import { describe, expect, it } from "vitest"

import { runAnalysis } from "../src/cli/runAnalysis"
import type { Metric } from "../src/analysis/types"

describe("repeated word defaults", () => {
  it("finds a repeated word across adjacent subtitle cues", async () => {
    const subsText = [
      "00:26:56:16\t00:26:58:22\t想辦法去注射去破壞掉",
      "we located the affected nerve and injected it to",
      "00:26:58:22\t00:27:00:12\t讓他可以止痛",
      "to relieve the pain.",
    ].join("\n")

    const output = (await runAnalysis(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output).toContainEqual(
      expect.objectContaining({
        type: "REPEATED_WORD",
        lineIndex: 3,
        index: 0,
        token: "to",
      })
    )
  })

  it("does not repeat a word across a punctuated cue boundary", async () => {
    const subsText = [
      "00:29:35:00\t00:29:36:29\t前一句",
      "I.",
      "00:29:36:29\t00:29:38:20\t我說你怎麼樣 會痛嗎",
      'I asked, "Does it hurt?"',
    ].join("\n")

    const output = (await runAnalysis(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output.map((metric) => metric.type)).not.toContain("REPEATED_WORD")
  })

  it("does not flag matching words separated by punctuation", async () => {
    const subsText = [
      "00:40:44:09\t00:40:45:07\t但是我大概念到",
      "But by junior high, high school, and college,",
      "00:40:45:07\t00:40:46:14\t國中 高中 大學以後",
      "But by junior high, high school, and college,",
      "00:40:46:14\t00:40:49:04\t我就開始很厭倦這些事情",
      "But by junior high, high school, and college,",
    ].join("\n")

    const output = (await runAnalysis(subsText, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output.map((metric) => metric.type)).not.toContain("REPEATED_WORD")
  })

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

  it("suppresses repeated-word findings with a trailing marker", async () => {
    const subsText = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We can can fix this. #",
    ].join("\n")
    const newsText = [
      "VO:",
      "We can can fix this. #",
    ].join("\n")
    const plainText = "We can can fix this. #"

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

    expect(subsOutput.map((metric) => String(metric.type))).not.toContain(
      "REPEATED_WORD"
    )
    expect(newsOutput.map((metric) => String(metric.type))).not.toContain(
      "REPEATED_WORD"
    )
    expect(textOutput.map((metric) => String(metric.type))).not.toContain(
      "REPEATED_WORD"
    )
  })
})
