import { describe, it, expect } from "vitest"
import { analyzeLines } from "../src/analysis/analyzeLines"
import { termVariantRule } from "../src/analysis/termVariantRule"

describe("termVariantRule", () => {
  it("flags configured disallowed variant and suggests canonical term", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We traveled to Pingdong last week.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "We returned to Pingtung yesterday.",
    ].join("\n")

    const metrics = analyzeLines(text, [
      termVariantRule({
        variants: [{ variant: "Pingdong", canonical: "Pingtung" }],
      }),
    ])
    const findings = metrics.filter((m) => m.type === "TERM_VARIANT")

    expect(findings).toHaveLength(1)
    expect(findings[0]?.token).toBe("Pingdong")
    expect(findings[0]?.expected).toBe("Pingtung")
  })

  it("returns no findings when no variants are configured", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We traveled to Pingdong last week.",
    ].join("\n")

    const metrics = analyzeLines(text, [termVariantRule()])
    expect(metrics.filter((m) => m.type === "TERM_VARIANT")).toEqual([])
  })
})
