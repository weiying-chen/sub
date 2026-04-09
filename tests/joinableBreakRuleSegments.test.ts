import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { joinableBreakRule } from "../src/analysis/joinableBreakRule"

describe("joinableBreakRule (segments)", () => {
  it("flags adjacent cues when the joined text still fits max chars", () => {
    const text = [
      "00:03:19:29\t00:03:20:26\t我的孩子說",
      "My kid said:",
      "00:03:20:26\t00:03:22:12\t妳就讓我喝一口",
      "\"Just let me have a sip.\"",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)

    const finding = metrics[0]
    expect(finding?.type).toBe("JOINABLE_BREAK")
    if (!finding || finding.type !== "JOINABLE_BREAK") return
    expect(finding.joinedLength).toBeLessThanOrEqual(finding.maxJoinedChars)
  })

  it("flags dash and conjunction style continuation breaks", () => {
    const text = [
      "00:07:51:16\t00:07:53:03\t是這一點有問題",
      "It was this---",
      "00:07:54:01\t00:07:55:08\t這裡有問題",
      "right here.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]?.type).toBe("JOINABLE_BREAK")
  })

  it("does not flag when joining would exceed max chars", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "This first translation chunk is intentionally quite long",
      "00:00:09:00\t00:00:10:00\tMarker",
      "and this continuation makes the merged line exceed limit.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the timing gap is too large", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "My kid said:",
      "00:00:12:00\t00:00:13:00\tMarker",
      "\"Just let me have a sip.\"",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })
})
