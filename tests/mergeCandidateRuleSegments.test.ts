import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { mergeCandidateRule } from "../src/analysis/mergeCandidateRule"

describe("mergeCandidateRule (segments)", () => {
  it("does not flag exact duplicate translations used for spanning", () => {
    const text = [
      "00:26:54:00\t00:26:56:16\t我們找到了受影響的神經",
      "we located the affected nerve and injected it to",
      "00:26:56:16\t00:26:58:22\t想辦法去注射去破壞掉",
      "we located the affected nerve and injected it to",
      "00:26:58:22\t00:27:00:12\t讓他可以止痛",
      "to relieve the pain.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])

    expect(metrics).toHaveLength(0)
  })

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

  it("does not flag manually suppressed countdown cues", () => {
    const text = [
      "00:05:06:14\t00:05:07:16\t五",
      "Five. #",
      "00:05:07:16\t00:05:08:24\t四",
      "Four. #",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(0)
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

  it("does not flag when one cue adds a trailing word beyond threshold", () => {
    const text = [
      "00:07:09:14\t00:07:11:23\t手麻 不舒服",
      "This is a long paragrph This is a long paragrph delay",
      "00:07:11:23\t00:07:14:19\t再加上 脖子痠痛",
      "This is a long paragrph This is a long paragrph",
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

  it("flags case-only differences between adjacent cues", () => {
    const text = [
      "00:11:20:26\t00:11:21:27\t不只是金錢",
      "He gave up not just money, but also a home.",
      "00:11:21:27\t00:11:22:24\t包括房子",
      "he gave up not just money, but also a home.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(1)

    const finding = metrics[0]
    expect(finding?.type).toBe("MERGE_CANDIDATE")
    if (!finding || finding.type !== "MERGE_CANDIDATE") return
    expect(finding.editDistance).toBe(1)
  })

  it("flags internal whitespace differences between adjacent cues", () => {
    const text = [
      "00:11:20:26\t00:11:21:27\t不只是金錢",
      "He gave up not just money, but also a home.",
      "00:11:21:27\t00:11:22:24\t包括房子",
      "He gave up not just money,  but also a home.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(1)

    const finding = metrics[0]
    expect(finding?.type).toBe("MERGE_CANDIDATE")
    if (!finding || finding.type !== "MERGE_CANDIDATE") return
    expect(finding.editDistance).toBe(1)
  })

  it("does not flag when a different middle word changes meaning", () => {
    const text = [
      "00:22:00:09\t00:22:01:05\t當我難過了",
      "When I'm upset, I've got something to say.",
      "00:22:01:10\t00:22:02:20\t當我悲傷了",
      "When I'm hurting, I've got something to say.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when edit distance is five", () => {
    const text = [
      "00:22:00:09\t00:22:01:05\t當我難過了",
      "Gap text",
      "00:22:01:10\t00:22:02:20\t當我悲傷了",
      "Gap text abcd",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [mergeCandidateRule()])
    expect(metrics).toHaveLength(0)
  })

})
