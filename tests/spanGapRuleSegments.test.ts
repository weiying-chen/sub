import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { spanGapRule } from "../src/analysis/spanGapRule"

describe("spanGapRule (segments)", () => {
  it("flags identical adjacent cues when the text disappears and reappears", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello there.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Hello there.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [spanGapRule()])
    expect(metrics).toHaveLength(1)

    const finding = metrics[0]
    expect(finding?.type).toBe("SPAN_GAP")
    expect(finding?.lineIndex).toBe(1)
    if (!finding || finding.type !== "SPAN_GAP") return
    expect(finding.nextLineIndex).toBe(3)
    expect(finding.gapFrames).toBe(30)
  })

  it("does not flag when the repeated text is continuous with no timing gap", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello there.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hello there.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [spanGapRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the repeated text only has a tiny frame gap", () => {
    const text = [
      "00:10:23:10\t00:10:24:15\tMarker",
      "the Taipei Waterworks Museum, or even all the way",
      "00:10:24:17\t00:10:28:07\tMarker",
      "the Taipei Waterworks Museum, or even all the way",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [spanGapRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the text changes across the gap", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello there.",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Different text.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [spanGapRule()])
    expect(metrics).toHaveLength(0)
  })
})
