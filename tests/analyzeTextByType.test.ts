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
    expect(byPreview.get("5")?.lineIndex).toBe(1)
    expect(byPreview.get("eleven")?.lineIndex).toBe(3)
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
    expect(findings[0]).toMatchObject({ preview: "4", lineIndex: 2 })
  })

  it("flags English lines inside mixed news paragraphs", () => {
    const text = [
      "中文內容在這裡。",
      "tetetete 4",
      "還有一些中文。",
    ].join("\n")

    const metrics = analyzeTextByType(text, "news", [numberStyleRule()])
    const findings = metrics.filter((m) => m.type === "NUMBER_STYLE")

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ preview: "4", lineIndex: 1 })
  })
})
