import { describe, it, expect } from "vitest"
import { analyzeLines } from "../src/analysis/analyzeLines"
import { capitalizationRule } from "../src/analysis/capitalizationRule"

describe("capitalizationRule", () => {
  it("flags lowercase terms provided and ignores proper case", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We support indigenous communities.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Indigenous leadership matters.",
    ].join("\n")

    const metrics = analyzeLines(text, [
      capitalizationRule({ terms: ["Indigenous"] }),
    ])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["indigenous"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("indigenous")?.expected).toBe("Indigenous")
  })

  it("returns no findings when no terms are configured", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We support indigenous communities.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Indigenous leadership matters.",
    ].join("\n")

    const metrics = analyzeLines(text, [capitalizationRule()])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    expect(findings).toEqual([])
  })

  it("uses custom capitalization terms when provided", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We traveled to riverton last summer.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "We support indigenous communities.",
    ].join("\n")

    const metrics = analyzeLines(text, [
      capitalizationRule({ terms: ["Riverton"] }),
    ])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["riverton"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("riverton")?.expected).toBe("Riverton")
  })

  it("flags partial-case mismatches for multi-word terms", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Tzu Chi follows the Bodhisattva path in action.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Tzu Chi follows the Bodhisattva Path in action.",
    ].join("\n")

    const metrics = analyzeLines(text, [
      capitalizationRule({ terms: ["the Bodhisattva Path"] }),
    ])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    const tokens = findings.map((f) => f.token)
    expect(tokens).toEqual(["the Bodhisattva path"])
    expect(findings[0]?.expected).toBe("the Bodhisattva Path")
  })
})
