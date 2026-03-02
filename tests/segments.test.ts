import { describe, it, expect } from "vitest"

import { parseNews, parseSubs } from "../src/analysis/segments"

describe("parseSubs", () => {
  it("returns payload segments anchored to payload lines", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello world.",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Second line.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "",
      "00:00:04:00\t00:00:05:00\tMarker",
      "Third line.",
    ].join("\n")

    const segments = parseSubs(text)

    expect(segments.find((s) => s.lineIndex === 1)?.text).toBe("Hello world.")
    expect(segments.find((s) => s.lineIndex === 4)?.text).toBe("Second line.")
    expect(segments.find((s) => s.lineIndex === 8)?.text).toBe("Third line.")
  })

  it("recognizes timestamp lines with leading markers", () => {
    const text = [
      "XXX 00:00:01:00\t00:00:02:00\tMarker",
      "Hello world.",
    ].join("\n")

    const segments = parseSubs(text)

    expect(segments).toHaveLength(1)
    expect(segments[0]?.lineIndex).toBe(1)
    expect(segments[0]?.text).toBe("Hello world.")
  })
})

describe("parseNews", () => {
  it("tags VO/SUPER blocks and ignores non-content lines", () => {
    const text = [
      "1_0001",
      "(metadata)",
      "First sentence.",
      "",
      "/*SUPER:",
      "super meta line",
      "*/",
      "Super line one.",
      "Super line two.",
      "",
      "Trailing VO line.",
    ].join("\n")

    const segments = parseNews(text)

    expect(segments).toMatchObject([
      {
        lineIndex: 2,
        lineIndexEnd: 2,
        text: "First sentence.",
        blockType: "vo",
        marker: { raw: "1_0001", index: 1, time: 1, valid: true, lineIndex: 0 },
      },
      {
        lineIndex: 7,
        lineIndexEnd: 8,
        text: "Super line one. Super line two.",
        blockType: "super",
      },
      {
        lineIndex: 10,
        lineIndexEnd: 10,
        text: "Trailing VO line.",
        blockType: "vo",
      },
    ])
  })

  it("keeps untranslated VO and SUPER blocks as segments with empty targets", () => {
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

    const segments = parseNews(text)

    expect(segments).toMatchObject([
      {
        lineIndex: 1,
        lineIndexEnd: 1,
        text: "",
        blockType: "vo",
        targetLines: [],
        sourceText: "這是一段旁白",
      },
      {
        lineIndex: 4,
        lineIndexEnd: 5,
        text: "",
        blockType: "super",
        targetLines: [],
        sourceText: "人物名稱// 這是一段字卡",
      },
    ])
  })

  it("preserves marker metadata on following news blocks", () => {
    const text = [
      "1_0001",
      "First sentence.",
      "",
      "2_0008",
      "Second sentence.",
    ].join("\n")

    const segments = parseNews(text)

    expect(segments).toMatchObject([
      {
        lineIndex: 1,
        marker: { raw: "1_0001", index: 1, time: 1, valid: true, lineIndex: 0 },
      },
      {
        lineIndex: 4,
        marker: { raw: "2_0008", index: 2, time: 8, valid: true, lineIndex: 3 },
      },
    ])
  })

  it("parses SUPER_PEOPLE entries as dedicated news segments", () => {
    const text = [
      "SUPER_PEOPLE:",
      "病患 | 羅伯托",
      "Roberto",
      "Patient",
      "",
      "醫師 | 林醫師",
      "Dr. Lin",
      "Chief Physician",
      "Harbor Clinic",
      "",
      "1_0001",
      "中文內文。",
      "English line.",
    ].join("\n")

    const segments = parseNews(text)

    expect(segments).toMatchObject([
      {
        lineIndex: 1,
        lineIndexEnd: 3,
        blockType: "super_people",
        superPerson: {
          zhTitle: "病患",
          zhName: "羅伯托",
          enName: "Roberto",
          enTitle: "Patient",
        },
      },
      {
        lineIndex: 5,
        lineIndexEnd: 8,
        blockType: "super_people",
        superPerson: {
          zhTitle: "醫師",
          zhName: "林醫師",
          enName: "Dr. Lin",
          enTitle: "Chief Physician",
          organization: "Harbor Clinic",
        },
      },
      {
        lineIndex: 12,
        blockType: "vo",
        sourceText: "中文內文。",
        text: "English line.",
      },
    ])
  })
})
