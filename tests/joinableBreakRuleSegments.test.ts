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

  it("flags continuation when left side is conjunction-style but ends with comma", () => {
    const text = [
      "00:22:34:22\t00:22:35:17\t具體來講",
      "So after hearing all this,",
      "00:22:35:17\t00:22:36:07\t聽了那麼多",
      "So after hearing all this,",
      "00:22:36:07\t00:22:37:11\t講了那麼多",
      "So after hearing all this,",
      "00:22:37:11\t00:22:38:28\t到底具體我應該要怎麼做",
      "what should you do?",
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

  it("does not flag when left side is a complete sentence before a comma-ended continuation", () => {
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

  it("does not flag when the next line does not end with sentence punctuation", () => {
    const text = [
      "00:10:08:10\t00:10:09:20\t來到了財務",
      "Now, finances.",
      "00:10:09:20\t00:10:11:18\t會關注到財務重點",
      "I once had a client",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags when the next line ends with a comma and join still fits", () => {
    const text = [
      "00:18:53:06\t00:18:54:17\t在什麼地方",
      "where they came from,",
      "00:18:54:17\t00:18:57:19\t他所期待產生的後果是什麼",
      "what outcome was intended,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]?.type).toBe("JOINABLE_BREAK")
  })

  it("does not flag when left side is a complete sentence and next is a trailing fragment", () => {
    const text = [
      "00:05:17:01\t00:05:19:06\t他們兩個八十幾歲",
      "They were both in their 80s.",
      "00:05:19:06\t00:05:21:20\t今年非常不幸地",
      "Unfortunately, this year,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when left side ends a question and next line is an incomplete clause", () => {
    const text = [
      "00:10:31:02\t00:10:32:17\t什麼叫做真情",
      "\"Do you even know what love is?\"",
      "00:10:32:17\t00:10:34:19\t所以最後",
      "But A Guang was kind,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })
})
