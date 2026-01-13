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
  it("coalesces paragraphs into single segments", () => {
    const text = [
      "VO:",
      "First sentence.",
      "Second sentence.",
      "",
      "SOT:",
      "Another paragraph.",
      "",
      "",
      "Trailing.",
    ].join("\n")

    const segments = parseNews(text)

    expect(segments).toMatchObject([
      { lineIndex: 0, text: "VO: First sentence. Second sentence." },
      { lineIndex: 4, text: "SOT: Another paragraph." },
      { lineIndex: 8, text: "Trailing." },
    ])
  })
})
