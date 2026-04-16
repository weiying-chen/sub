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

  it("does not flag when previous line looks like an incomplete sentence fragment", () => {
    const text = [
      "00:05:04:04\t00:05:05:06\t這樣的一些辛苦",
      "went through this.",
      "00:05:05:07\t00:05:07:11\t更何況是一般社會大眾呢",
      "So imagine everyone else.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag adjacent duplicate translations used for spanning", () => {
    const text = [
      "00:05:19:29\t00:05:20:22\t我們在面對",
      "When a new life is coming,",
      "00:05:20:22\t00:05:21:18\t新生命的到來",
      "When a new life is coming,",
      "00:05:21:18\t00:05:22:24\t我們會花很多心思",
      "we put a lot of thought into preparing for it.",
      "00:05:22:24\t00:05:24:25\t去準備待產包",
      "we put a lot of thought into preparing for it.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the next line is an incomplete sentence fragment", () => {
    const text = [
      "00:17:59:13\t00:18:00:17\t概念上大概是這樣",
      "That's the basic idea.",
      "00:18:00:17\t00:18:02:12\t如果你有相關的需求",
      "That's the basic idea.",
      "00:18:02:12\t00:18:03:16\t就可以回頭再去",
      "If you want to know more,",
      "00:18:03:16\t00:18:04:14\t認真研究起來",
      "If you want to know more,",
      "00:18:04:14\t00:18:06:15\t什麼叫做意定監護",
      "you can always look into it later.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })
})
