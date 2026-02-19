import { describe, expect, it } from "vitest"

import { getTimestampRunState } from "../src/cm/timestampLinkGutter"
import type { Finding } from "../src/analysis/types"

function finding(
  type: Finding["type"],
  lineIndex: number,
  tsLineIndex: number
): Finding {
  if (type === "MAX_CPS") {
    return {
      type,
      lineIndex,
      tsLineIndex,
      text: "x",
      cps: 25,
      maxCps: 17,
      durationFrames: 24,
      charCount: 10,
      severity: "error",
    }
  }
  if (type === "MIN_CPS") {
    return {
      type,
      lineIndex,
      tsLineIndex,
      text: "x",
      cps: 5,
      minCps: 10,
      durationFrames: 24,
      charCount: 10,
      severity: "warn",
    }
  }
  if (type === "CPS_BALANCE") {
    return {
      type,
      lineIndex,
      tsLineIndex,
      cps: 12,
      neighborCps: 18,
      deltaCps: 6,
      severity: "warn",
    }
  }
  throw new Error(`Unsupported type in test helper: ${type}`)
}

describe("timestampLinkGutter", () => {
  it("keeps indicators neutral when colorize is false", () => {
    const findings: Finding[] = [
      finding("MAX_CPS", 1, 0),
      finding("MIN_CPS", 3, 2),
      finding("CPS_BALANCE", 5, 4),
    ]

    expect(getTimestampRunState(findings, 0, false)).toBe("ok")
    expect(getTimestampRunState(findings, 2, false)).toBe("ok")
    expect(getTimestampRunState(findings, 4, false)).toBe("ok")
  })

  it("uses severity states when colorize is true", () => {
    const findings: Finding[] = [
      finding("MAX_CPS", 1, 0),
      finding("MIN_CPS", 3, 2),
      finding("CPS_BALANCE", 5, 4),
    ]

    expect(getTimestampRunState(findings, 0, true)).toBe("flagged")
    expect(getTimestampRunState(findings, 2, true)).toBe("warn")
    expect(getTimestampRunState(findings, 4, true)).toBe("warn")
    expect(getTimestampRunState(findings, 10, true)).toBe("ok")
  })
})
