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
      "We traveled to hualien last summer.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "We support indigenous communities.",
    ].join("\n")

    const metrics = analyzeLines(text, [
      capitalizationRule({ terms: ["Hualien"] }),
    ])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["hualien"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("hualien")?.expected).toBe("Hualien")
  })
})
