import { describe, it, expect } from "vitest"

import { buildSegmentsOutput } from "../src/cli/segmentsOutput"

describe("segments output", () => {
  it("builds subs segment structures", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello world.",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Second line.",
    ].join("\n")

    const output = buildSegmentsOutput(text, { type: "subs" })

    expect(output).toHaveLength(2)
    expect(output[0]).toMatchObject({
      lineIndex: 1,
      lineIndexEnd: 1,
      text: "Hello world.",
      tsIndex: 0,
      payloadIndex: 1,
    })
  })

  it("builds news vo and super segment structures", () => {
    const text = [
      "Voice-over line one.",
      "Voice-over line two.",
      "",
      "/*SUPER:",
      "中文//",
      "*/",
      "Super line.",
      "",
    ].join("\n")

    const output = buildSegmentsOutput(text, { type: "news" })

    expect(output).toHaveLength(2)
    expect(output[0]).toMatchObject({
      blockType: "vo",
      text: "Voice-over line one. Voice-over line two.",
      targetLines: [
        { lineIndex: 0, text: "Voice-over line one." },
        { lineIndex: 1, text: "Voice-over line two." },
      ],
    })
    expect(output[1]).toMatchObject({
      blockType: "super",
      text: "Super line.",
      targetLines: [{ lineIndex: 6, text: "Super line." }],
    })
  })

  it("filters to one segment by index", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello world.",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Second line.",
    ].join("\n")

    const output = buildSegmentsOutput(text, {
      type: "subs",
      segmentIndex: 1,
    })

    expect(output).toHaveLength(1)
    expect(output[0]?.text).toBe("Second line.")
  })
})
