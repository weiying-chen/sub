import { describe, it, expect } from "vitest"

import type { Metric } from "../src/analysis/types"
import { buildAnalyzeOutput } from "../src/cli/analyzeOutput"

describe("analyze CLI output", () => {
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

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
    })) as Metric[]

    const maxChars = output.filter((metric) => metric.type === "MAX_CHARS")
    expect(maxChars.map((metric) => metric.lineIndex)).toEqual([4, 5])
  })

  it("returns missing-translation findings for untranslated news blocks", async () => {
    const text = [
      "1_0001",
      "這是一段旁白",
      "",
      "/*SUPER:",
      "人物名稱//",
      "這是一段字卡",
      "*/",
      "",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(output).toMatchObject([
      {
        type: "MISSING_TRANSLATION",
        lineIndex: 1,
        blockType: "vo",
        text: "這是一段旁白",
      },
      {
        type: "MISSING_TRANSLATION",
        lineIndex: 4,
        blockType: "super",
        text: "人物名稱// 這是一段字卡",
      },
    ])
  })

  it("returns only CPS metrics for subs metrics mode", async () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Short line.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Another line.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "subs",
    })) as Metric[]

    expect(output).toHaveLength(2)
    expect(output.map((metric) => metric.type)).toEqual(["CPS", "CPS"])
    expect(output.map((metric) => metric.lineIndex)).toEqual([1, 3])
  })

  it("can filter subs metrics by CPS family rule filter", async () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Short line.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Another line.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "subs",
      ruleFilters: ["MAX_CPS"],
    })) as Metric[]

    expect(output).toHaveLength(2)
    expect(output.map((metric) => metric.type)).toEqual(["CPS", "CPS"])
    expect(output.map((metric) => metric.lineIndex)).toEqual([1, 3])
  })

  it("returns findings in findings mode", async () => {
    const text = [
      "00:00:01:00\t00:00:03:00\tMarker",
      "Hi",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output.some((metric) => metric.type === "CPS")).toBe(false)
    expect(output.some((metric) => metric.type === "MIN_CPS")).toBe(true)
  })

  it("includes merge-candidate findings for near-identical close cues", async () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "Gap text",
      "00:00:10:00\t00:00:11:00\tMarker",
      "Gap text.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output.some((metric) => metric.type === "MERGE_CANDIDATE")).toBe(true)
  })
})
