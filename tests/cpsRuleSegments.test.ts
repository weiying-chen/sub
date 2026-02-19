import { describe, it, expect } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { getFindings } from "../src/shared/findings"
import { cpsRule } from "../src/analysis/cpsRule"

describe("cpsRule (segments)", () => {
  it("merges identical consecutive payloads and anchors to payload lines", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Bye",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [cpsRule()])

    expect(metrics).toHaveLength(2)

    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    const hi = byLine.get(1)
    const bye = byLine.get(5)

    expect(hi?.durationFrames).toBe(60)
    expect(hi?.charCount).toBe(2)
    expect(hi?.cps).toBe(1)

    expect(bye?.durationFrames).toBe(30)
    expect(bye?.charCount).toBe(3)
    expect(bye?.cps).toBe(3)
  })

  it("flags low CPS below the minimum", () => {
    const text = [
      "00:00:01:00\t00:00:03:00\tMarker",
      "Hi",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [cpsRule(17, 10)])
    const findings = getFindings(metrics).filter((m) => m.type === "MIN_CPS")

    expect(findings).toHaveLength(1)
    expect(findings[0].cps).toBeLessThan(10)
    expect(findings[0].minCps).toBe(10)
  })

  it("treats empty lines as breaks between identical payloads by default", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [cpsRule()])

    expect(metrics).toHaveLength(2)
    const byLine = new Map(metrics.map((m) => [m.lineIndex, m]))
    expect(byLine.has(1)).toBe(true)
    expect(byLine.has(4)).toBe(true)
  })

  it("can ignore empty lines between identical payloads when opted in", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [
      cpsRule(17, 10, { ignoreEmptyLines: true }),
    ])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]?.lineIndex).toBe(1)
  })
})
