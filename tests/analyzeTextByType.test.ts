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

    const previews = findings.map((f) => f.preview).sort()
    expect(previews).toEqual(["5", "eleven"])

    const byPreview = new Map(findings.map((f) => [f.preview, f]))
    expect(byPreview.get("5")?.lineIndex).toBe(1)
    expect(byPreview.get("eleven")?.lineIndex).toBe(3)
  })

  it("uses news parsing (paragraph anchors)", () => {
    const text = [
      "VO:",
      "We saw 5 birds.",
      "",
      "Another line with eleven birds.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    const previews = findings.map((f) => f.preview).sort()
    expect(previews).toEqual(["5", "eleven"])

    const byPreview = new Map(findings.map((f) => [f.preview, f]))
    expect(byPreview.get("5")?.lineIndex).toBe(0)
    expect(byPreview.get("eleven")?.lineIndex).toBe(3)
  })
})
