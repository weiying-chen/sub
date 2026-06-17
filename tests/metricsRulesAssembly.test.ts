import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createSubsFindingsRulesMock: vi.fn(() => []),
  createSubsMetricsRulesMock: vi.fn(() => []),
}))

vi.mock("../src/analysis/subsSegmentRules", () => ({
  createSubsFindingsRules: mocks.createSubsFindingsRulesMock,
  createSubsMetricsRules: mocks.createSubsMetricsRulesMock,
}))

vi.mock("../src/cli/properNouns", () => ({
  loadCapitalizationTerms: vi.fn(async () => ["OpenAI"]),
  loadTermVariants: vi.fn(async () => [{ variant: "Pingdong", canonical: "Pingtung" }]),
  loadProperNouns: vi.fn(async () => ["Taipei"]),
  loadAbbreviations: vi.fn(async () => ["Mr.", "U.S."]),
}))

import { runAnalysis } from "../src/cli/runAnalysis"

describe("runAnalysis rule assembly", () => {
  beforeEach(() => {
    mocks.createSubsFindingsRulesMock.mockClear()
    mocks.createSubsMetricsRulesMock.mockClear()
  })

  it("uses shared subs findings assembly for subs findings mode", async () => {
    await runAnalysis(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", mode: "findings", ignoreEmptyLines: true }
    )

    expect(mocks.createSubsFindingsRulesMock).toHaveBeenCalled()
    expect(mocks.createSubsFindingsRulesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        capitalizationTerms: ["OpenAI"],
        termVariants: [{ variant: "Pingdong", canonical: "Pingtung" }],
        properNouns: ["Taipei"],
        abbreviations: ["Mr.", "U.S."],
        ignoreEmptyLines: true,
      })
    )
    expect(mocks.createSubsMetricsRulesMock).not.toHaveBeenCalled()
  })

  it("uses shared subs metrics assembly for subs metrics mode", async () => {
    await runAnalysis(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", ruleFilters: ["MAX_CPS"] }
    )

    expect(mocks.createSubsMetricsRulesMock).toHaveBeenCalledWith({
      capitalizationTerms: ["OpenAI"],
      termVariants: [{ variant: "Pingdong", canonical: "Pingtung" }],
      properNouns: ["Taipei"],
      abbreviations: ["Mr.", "U.S."],
      ignoreEmptyLines: undefined,
      enabledFindingTypes: ["MAX_CPS"],
    })
    expect(mocks.createSubsFindingsRulesMock).not.toHaveBeenCalled()
  })
})
