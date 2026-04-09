import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import type { Metric } from "../src/analysis/types"
import { getFindings } from "../src/shared/findings"
import {
  TIMESTAMP_FORMAT_FINDING_INSTRUCTION,
  TIMESTAMP_FORMAT_MODAL_EXPLANATION,
} from "../src/shared/wording"

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
        text: "00:00:01:00\t00:00:02:00\tMarker",
      },
      {
        type: "TIMESTAMP_FORMAT",
        lineIndex: 5,
        text: "bad timestamp",
      },
    ]

    const findings = getFindings(metrics)

    expect(findings[0]?.instruction).toBe("Reduce reading speed to 25 CPS or less.")
    expect(findings[1]?.instruction).toBe(
      "Add the missing translation below these timestamps."
    )
    expect(findings[2]?.instruction).toBe("Use a row with timestamps in this format: HH:MM:SS:FF<TAB>HH:MM:SS:FF<TAB>source text. You can optionally add XXX before the first timestamp.")
  })

  it("builds punctuation and timing-gap instructions in getFindings", () => {
    const metrics: Metric[] = [
      {
        type: "PUNCTUATION",
        lineIndex: 1,
        ruleCode: "MISSING_END_PUNCTUATION",
        text: "Missing punctuation",
      },
      {
        type: "MERGE_CANDIDATE",
        lineIndex: 3,
        nextLineIndex: 5,
        text: "Same line",
        nextText: "Same line.",
        gapFrames: 30,
        editDistance: 1,
      },
      {
        type: "SPAN_GAP",
        lineIndex: 7,
        nextLineIndex: 9,
        text: "Repeated line",
        nextText: "Repeated line",
        gapFrames: 30,
      },
    ]

    const findings = getFindings(metrics)
    expect(findings).toHaveLength(3)
    expect(findings[0]?.instruction).toBe(
      "End this translation with terminal punctuation (., ?, !, :, …, —, or '...')."
    )
    expect(findings[1]?.instruction).toBe(
      "These adjacent translations are very similar and close in time; consider merging them into one timestamp span."
    )
    expect(findings[2]?.instruction).toBe(
      "This translation disappears and reappears after a timing gap. Split or rewrite it instead of spanning across it."
    )
  })

  it("uses shared timestamp format wording for modal copy", () => {
    const appTsx = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8")

    expect(appTsx).toContain("TIMESTAMP_FORMAT_MODAL_EXPLANATION")
    expect(appTsx).toContain("./shared/wording")
    expect(appTsx).toContain("punctuation flow between translations")
    expect(appTsx).toContain("Warns when nearby translations can be merged.")
  })
})
