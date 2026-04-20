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

  it("does not flag missing translation when VO translation comes after blank spacer lines", async () => {
    const text = [
      "2_0059",
      "賴斯教授，在1996年對C型肝炎病毒的關鍵性發現，推動了藥物研發，讓C型肝炎從不治之症，轉變為可治療的疾病，全球有超過數百萬患者，都因此受惠。",
      "",
      "Back in 1996, Charles Rice made a key breakthrough in hepatitis C research.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(
      output.some((metric) => metric.type === "MISSING_TRANSLATION")
    ).toBe(false)
  })

  it("does not flag missing translation when multiple VO source paragraphs map to one translation", async () => {
    const text = [
      "2_0059",
      "賴斯教授，在1996年對C型肝炎病毒的關鍵性發現，推動了藥物研發，讓C型肝炎從不治之症，轉變為可治療的疾病，全球有超過數百萬患者，都因此受惠。",
      "",
      "雖然不是第一次造訪台灣，但是對於台灣的肝炎防治成果，與未來的相關研究，他也給予肯定。",
      "",
      "Back in 1996, Charles Rice made a key breakthrough in hepatitis C research that helped drive new treatments, turning it from an incurable disease into one that can be treated and benefiting millions worldwide. Even though this isn't his first time in Taiwan, he also praised its progress in hepatitis prevention and future research.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(
      output.some((metric) => metric.type === "MISSING_TRANSLATION")
    ).toBe(false)
  })

  it("skips SUPER missing-translation when a tilde placeholder is present", async () => {
    const text = [
      "1_0001",
      "這是一段旁白",
      "",
      "/*SUPER:",
      "人物名稱//",
      "這是一段字卡",
      "*/",
      "~",
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
    ])
    expect(
      output.some(
        (metric) =>
          metric.type === "MISSING_TRANSLATION" &&
          metric.blockType === "super"
      )
    ).toBe(false)
  })

  it("returns news marker findings for bad format, order, and backward time", async () => {
    const text = [
      "1_0010",
      "First sentence.",
      "",
      "3_0008",
      "Second sentence.",
      "",
      "bad_marker",
      "Third sentence.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(output).toMatchObject([
      {
        type: "NEWS_MARKER",
        lineIndex: 3,
        markerRaw: "3_0008",
        ruleCode: "NON_SEQUENTIAL_INDEX",
      },
      {
        type: "NEWS_MARKER",
        lineIndex: 3,
        markerRaw: "3_0008",
        ruleCode: "NON_INCREASING_TIME",
      },
      {
        type: "NEWS_MARKER",
        lineIndex: 6,
        markerRaw: "bad_marker",
        ruleCode: "INVALID_FORMAT",
      },
    ])
  })

  it("does not return news marker findings for markers before SUPER blocks", async () => {
    const text = [
      "1_0001",
      "/*SUPER:",
      "人物名稱//",
      "*/",
      "Super line.",
      "",
      "VO line.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(output.some((metric) => metric.type === "NEWS_MARKER")).toBe(false)
  })

  it("returns SUPER_PEOPLE findings for swapped name-title order and title case", async () => {
    const text = [
      "SUPER_PEOPLE:",
      "病患 | 王大明",
      "Patient care coordinator",
      "Alex Wang",
      "",
      "醫師 | 陳醫師",
      "Dr. Chen",
      "Chief Physician",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(output).toMatchObject([
      {
        type: "SUPER_PEOPLE",
        lineIndex: 2,
        ruleCode: "NAME_TITLE_ORDER",
      },
      {
        type: "SUPER_PEOPLE",
        lineIndex: 7,
        ruleCode: "TITLE_NOT_SENTENCE_CASE",
      },
    ])
  })

  it("returns SUPER_PEOPLE findings for missing English name and title", async () => {
    const text = [
      "SUPER_PEOPLE:",
      "病患 | 羅伯托",
      "Patient coordinator",
      "",
      "醫師 | 林醫師",
      "Dr. Lin",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "news",
      mode: "findings",
    })) as Metric[]

    expect(output).toMatchObject([
      {
        type: "SUPER_PEOPLE",
        lineIndex: 2,
        ruleCode: "MISSING_EN_NAME",
      },
      {
        type: "SUPER_PEOPLE",
        lineIndex: 5,
        ruleCode: "MISSING_EN_TITLE",
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

  it("uses full default subs findings set in findings mode", async () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "  This should drift—apart and I can’t ignore it.",
      "00:00:03:00\t00:00:04:00\tMarker",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "subs",
      mode: "findings",
    })) as Metric[]

    expect(output.some((metric) => metric.type === "LEADING_WHITESPACE")).toBe(true)
    expect(output.some((metric) => metric.type === "DASH_STYLE")).toBe(true)
    expect(output.some((metric) => metric.type === "QUOTE_STYLE")).toBe(true)
    expect(output.some((metric) => metric.type === "BLOCK_STRUCTURE")).toBe(true)
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

  it("includes baseline findings in subs findings mode when baseline text is provided", async () => {
    const baseline = [
      "00:00:01:00\t00:00:02:00\tSRC1",
      "First line.",
    ].join("\n")

    const current = [
      "00:00:01:00\t00:00:02:00\tSRC1 changed",
      "First line.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(current, {
      type: "subs",
      mode: "findings",
      baselineText: baseline,
      ruleFilters: ["BASELINE"],
    })) as Metric[]

    expect(output.some((metric) => metric.type === "BASELINE")).toBe(true)
  })

  it("supports text findings mode on English-only lines without timestamps", async () => {
    const text = [
      "這一行中文應該被忽略 123",
      "This line is definitely longer than the configured maximum character count for one subtitle row.",
      "  Another English line with leading spaces.",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "text" as any,
      mode: "findings",
    } as any)) as Metric[]

    expect(output.some((metric) => metric.type === "MAX_CHARS")).toBe(true)
    expect(output.some((metric) => metric.type === "LEADING_WHITESPACE")).toBe(true)
    expect(
      output.some(
        (metric) =>
          "text" in metric &&
          typeof metric.text === "string" &&
          metric.text.includes("中文")
      )
    ).toBe(false)
  })

  it("does not include punctuation findings in text mode defaults", async () => {
    const text = [
      "First sentence without ending",
      "Second Sentence starts with capital",
    ].join("\n")

    const output = (await buildAnalyzeOutput(text, {
      type: "text" as any,
      mode: "findings",
    } as any)) as Metric[]

    expect(output.some((metric) => metric.type === "PUNCTUATION")).toBe(false)
  })
})
