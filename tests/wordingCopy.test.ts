import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { getFindings } from "../src/shared/findings"
import { spanGapRule } from "../src/analysis/spanGapRule"
import type { Metric } from "../src/analysis/types"

describe("wording copy", () => {
  it("uses updated finding instructions for max cps and missing translation", () => {
    const metrics: Metric[] = [
      {
        type: "MAX_CPS",
        lineIndex: 1,
        tsLineIndex: 0,
        text: "Fast",
        cps: 30,
        maxCps: 25,
        durationFrames: 24,
        charCount: 4,
        severity: "error",
      },
      {
        type: "BLOCK_STRUCTURE",
        lineIndex: 3,
        ruleCode: "MISSING_TRANSLATION",
        text: "00:00:01:00	00:00:02:00	Marker",
      },
    ]

    const findings = getFindings(metrics)

    expect(findings[0]?.instruction).toBe("Reduce reading speed to 25 CPS or less.")
    expect(findings[1]?.instruction).toBe(
      "Add the missing English line below this timestamp."
    )
  })

  it("uses updated span-gap wording", () => {
    const rule = spanGapRule()
    const segments = [
      { lineIndex: 1, text: "Same line", startFrames: 0, endFrames: 10 },
      { lineIndex: 3, text: "Same line", startFrames: 14, endFrames: 24 },
    ]

    const metrics = rule({
      segment: segments[0],
      segmentIndex: 0,
      segments,
    })

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "SPAN_GAP",
      instruction:
        "This line disappears and reappears after a timing gap. Split or rewrite it instead of spanning across it.",
    })
  })

  it("uses updated modal description for block structure", () => {
    const appTsx = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8")

    expect(appTsx).toContain(
      'explanation: "Flags timestamp rows that are missing a translation line."'
    )
  })
})
