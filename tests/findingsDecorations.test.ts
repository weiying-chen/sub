import { describe, expect, it } from "vitest"

import {
  buildDecorationLayers,
  sortFindingsForDecorations,
  subtractOverlapsBySeverity,
} from "../src/cm/findingsDecorations"
import type { Finding } from "../src/analysis/types"

describe("sortFindingsForDecorations", () => {
  it("orders warnings before errors so errors draw on top", () => {
    const findings: Finding[] = [
      {
        type: "MIN_CPS",
        lineIndex: 0,
        text: "This is 5 examples.",
        cps: 5,
        minCps: 10,
        durationFrames: 240,
        charCount: 19,
        severity: "warn",
      },
      {
        type: "NUMBER_STYLE",
        lineIndex: 0,
        index: 8,
        value: 5,
        found: "digits",
        expected: "words",
        token: "5",
        text: "This is 5 examples.",
        severity: "error",
      },
    ]

    const sorted = sortFindingsForDecorations(findings)
    expect(sorted[0]?.finding.type).toBe("MIN_CPS")
    expect(sorted[1]?.finding.type).toBe("NUMBER_STYLE")
  })

  it("keeps findings ordered by line index for range builder safety", () => {
    const findings: Finding[] = [
      {
        type: "MIN_CPS",
        lineIndex: 4,
        text: "later warn",
        cps: 5,
        minCps: 10,
        durationFrames: 240,
        charCount: 9,
        severity: "warn",
      },
      {
        type: "NUMBER_STYLE",
        lineIndex: 1,
        index: 0,
        value: 5,
        found: "digits",
        expected: "words",
        token: "5",
        text: "early error",
        severity: "error",
      },
    ]

    const sorted = sortFindingsForDecorations(findings)
    expect(sorted[0]?.finding.lineIndex).toBeLessThanOrEqual(
      sorted[1]?.finding.lineIndex ?? Infinity
    )
  })
})

describe("subtractOverlapsBySeverity", () => {
  it("keeps error ranges and removes warning overlap segments", () => {
    const out = subtractOverlapsBySeverity([
      { from: 0, to: 10, className: "cm-finding-warn", severity: "warn" },
      { from: 2, to: 5, className: "cm-finding-error", severity: "error" },
    ])

    expect(out).toEqual([
      { from: 0, to: 2, className: "cm-finding-warn", severity: "warn" },
      { from: 2, to: 5, className: "cm-finding-error", severity: "error" },
      { from: 5, to: 10, className: "cm-finding-warn", severity: "warn" },
    ])
  })

  it("splits a warning around multiple error ranges", () => {
    const out = subtractOverlapsBySeverity([
      { from: 0, to: 12, className: "cm-finding-warn", severity: "warn" },
      { from: 2, to: 4, className: "cm-finding-error", severity: "error" },
      { from: 7, to: 9, className: "cm-finding-error", severity: "error" },
    ])

    expect(out).toEqual([
      { from: 0, to: 2, className: "cm-finding-warn", severity: "warn" },
      { from: 2, to: 4, className: "cm-finding-error", severity: "error" },
      { from: 4, to: 7, className: "cm-finding-warn", severity: "warn" },
      { from: 7, to: 9, className: "cm-finding-error", severity: "error" },
      { from: 9, to: 12, className: "cm-finding-warn", severity: "warn" },
    ])
  })
})

describe("buildDecorationLayers", () => {
  it("keeps active highlight even when warning overlap is clipped by error", () => {
    const out = buildDecorationLayers(
      [
        { from: 0, to: 10, className: "cm-finding-warn", severity: "warn" },
        { from: 0, to: 10, className: "cm-finding-error", severity: "error" },
      ],
      [{ from: 0, to: 10 }]
    )

    expect(out).toContainEqual({
      from: 0,
      to: 10,
      className: "cm-finding-active",
    })
  })
})
