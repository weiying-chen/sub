import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { createSubsSegmentRules } from "../src/analysis/subsSegmentRules"
import { getFindings } from "../src/shared/findings"

describe("blockStructureRule (segments)", () => {
  it("flags orphan payload lines between subtitle cues", () => {
    const text = [
      "00:10:00:20\t00:10:02:13\t把他們整個改過來",
      "with hearing aids or cochlear implants.",
      "",
      "Kids were checked again at age three or four",
      "00:10:02:13\t00:10:04:06\t後期大概在三四歲的時候",
      "Kids were checked again at age three or four",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE" as any],
        })
      )
    )

    expect(findings).toMatchObject([
      {
        type: "BLOCK_STRUCTURE",
        lineIndex: 3,
        ruleCode: "ORPHAN_PAYLOAD",
        text: "Kids were checked again at age three or four",
      },
    ])
  })

  it("flags timestamps that have no payload line", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\t只有時間",
      "00:00:02:00\t00:00:03:00\t下一行",
      "Hello there.",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE" as any],
        })
      )
    )

    expect(findings).toMatchObject([
      {
        type: "BLOCK_STRUCTURE",
        lineIndex: 0,
        ruleCode: "MISSING_PAYLOAD",
      },
    ])
  })
})
