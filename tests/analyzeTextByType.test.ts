import { describe, it, expect } from "vitest"

import { numberStyleRule } from "../src/analysis/numberStyleRule"
import { analyzeTextByType } from "../src/analysis/analyzeTextByType"

describe("analyzeTextByType", () => {
  it("uses subs parsing (payload line anchors)", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We saw 5 birds.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "We saw eleven birds.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["5", "eleven"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("5")?.lineIndex).toBe(1)
    expect(byToken.get("eleven")?.lineIndex).toBe(3)
  })

  it("normalizes CRLF input text for subs parsing", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We saw 5 birds.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "We saw eleven birds.",
    ].join("\r\n")

    const metrics = analyzeTextByType(text, "subs", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["5", "eleven"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("5")?.lineIndex).toBe(1)
    expect(byToken.get("eleven")?.lineIndex).toBe(3)
  })

  it("uses news parsing (VO lines as candidates)", () => {
    const text = [
      "VO:",
      "We saw 5 birds.",
      "",
      "Another line with eleven birds.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["5", "eleven"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("5")?.lineIndex).toBe(1)
    expect(byToken.get("eleven")?.lineIndex).toBe(3)
  })

  it("includes free-text lines for subs parsing", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hello world.",
      "Free text 4",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ token: "4", lineIndex: 2 })
  })

  it("flags English lines inside mixed news paragraphs", () => {
    const text = [
      "(meta line)",
      "tetetete 4",
      "[more meta]",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ token: "4", lineIndex: 1 })
  })
})
