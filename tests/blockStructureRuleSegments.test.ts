import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { createSubsSegmentRules } from "../src/analysis/subsSegmentRules"
import { getFindings } from "../src/shared/findings"

describe("blockStructureRule (segments)", () => {
  it("flags missing translations only inside subtitle sections that already contain translations", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\t第一句",
      "Hello there.",
      "00:00:02:00\t00:00:03:00\t第二句",
      "",
      "00:00:10:00\t00:00:11:00\t第三句",
      "Translated line.",
      "00:00:11:00\t00:00:12:00\t第四句",
      "Another translated line.",
      "00:00:12:00\t00:00:13:00\t第五句",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE"],
        })
      )
    )

    expect(findings).toMatchObject([
      {
        type: "BLOCK_STRUCTURE",
        lineIndex: 2,
        ruleCode: "MISSING_TRANSLATION",
        text: "00:00:02:00\t00:00:03:00\t第二句",
      },
      {
        type: "BLOCK_STRUCTURE",
        lineIndex: 8,
        ruleCode: "MISSING_TRANSLATION",
        text: "00:00:12:00\t00:00:13:00\t第五句",
      },
    ])
  })

  it("does not flag orphan translation duplication between subtitle cues", () => {
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

    expect(findings).toHaveLength(0)
  })

  it("does not flag trailing source or metadata lines outside timestamp blocks", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\t第一句",
      "Hello there.",
      "https://example.com/source",
      "DSM-5 reference line",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE"],
        })
      )
    )

    expect(findings).toHaveLength(0)
  })

  it("does not flag source links between timestamp blocks", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\t第一句",
      "Hello there.",
      "https://example.com/source",
      "00:00:02:00\t00:00:03:00\t第二句",
      "Goodbye there.",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE"],
        })
      )
    )

    expect(findings).toHaveLength(0)
  })

  it("does not count subtitle comments as translations", () => {
    const text = [
      "00:01:14:21\t00:01:16:16\t你拿起手機",
      "00:01:16:16\t00:01:18:07\t想要拍一張照片",
      "00:01:18:07\t00:01:20:07\t上傳到臉書上面",
      "// A slide of a finger pressing a phone",
      "00:01:20:07\t00:01:22:14\t可是突然沉默了兩秒鐘",
      "00:01:22:14\t00:01:23:22\t你心想",
      "",
      "00:01:32:07\t00:01:33:10\t隔天醒來",
      "The next translated section starts here.",
    ].join("\n")

    const findings = getFindings(
      analyzeTextByType(
        text,
        "subs",
        createSubsSegmentRules({
          enabledFindingTypes: ["BLOCK_STRUCTURE"],
        })
      )
    )

    expect(findings).toHaveLength(0)
  })
})
