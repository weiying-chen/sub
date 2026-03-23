import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { dashStyleRule } from "../src/analysis/dashStyleRule"

describe("dashStyleRule", () => {
  it("emits uppercase dash style codes", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This should stay---together, not drift—apart.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [dashStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      expected: "TRIPLE_HYPHEN",
      found: "EM_DASH",
    })
  })

  it("flags em dashes in subs text", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This should stay---together, not drift—apart.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [dashStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "DASH_STYLE",
      lineIndex: 1,
      expected: "TRIPLE_HYPHEN",
      found: "EM_DASH",
      blockType: "subs",
    })
  })

  it("does not flag triple hyphens in subs text", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "This should stay---together.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [dashStyleRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags triple hyphens in VO news text", () => {
    const text = [
      "VO:",
      "This should stay---together in VO.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [dashStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "DASH_STYLE",
      lineIndex: 1,
      expected: "EM_DASH",
      found: "TRIPLE_HYPHEN",
      blockType: "vo",
    })
  })

  it("flags em dashes in SUPER news text", () => {
    const text = [
      "/*SUPER:",
      "meta",
      "*/",
      "This should stay—together in SUPER.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [dashStyleRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "DASH_STYLE",
      lineIndex: 3,
      expected: "TRIPLE_HYPHEN",
      found: "EM_DASH",
      blockType: "super",
    })
  })

  it("does not flag em dashes in VO news text", () => {
    const text = [
      "VO:",
      "This should stay—together in VO.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [dashStyleRule()])
    expect(metrics).toHaveLength(0)
  })
})
