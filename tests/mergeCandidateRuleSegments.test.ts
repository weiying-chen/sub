import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { mergeCandidateRule } from "../src/analysis/mergeCandidateRule"

describe("mergeCandidateRule (segments)", () => {
  it("flags near-identical adjacent cues with small gap", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "Gap text",
      "00:00:10:00\t00:00:11:00\tMarker",
      "Gap text.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(1)

    const finding = metrics[0]
    expect(finding?.type).toBe("MERGE_CANDIDATE")
    expect(finding?.lineIndex).toBe(1)
    if (!finding || finding.type !== "MERGE_CANDIDATE") return
    expect(finding.nextLineIndex).toBe(3)
    expect(finding.editDistance).toBe(1)
    expect(finding.gapFrames).toBe(30)
  })

  it("does not flag when text difference is above threshold", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "Gap text",
      "00:00:10:00\t00:00:11:00\tMarker",
      "Completely different line",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the timing gap is too large", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "Gap text",
      "00:00:12:00\t00:00:13:00\tMarker",
      "Gap text.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(0)
  })
})
