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
  loadProperNouns: vi.fn(async () => ["Taipei"]),
}))

import { buildMetricsOutput } from "../src/cli/metricsCore"

describe("metricsCore rule assembly", () => {
  beforeEach(() => {
    mocks.createSubsFindingsRulesMock.mockClear()
    mocks.createSubsMetricsRulesMock.mockClear()
  })

  it("uses shared subs findings assembly for subs findings mode", async () => {
    await buildMetricsOutput(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", findingsOnly: true, ignoreEmptyLines: true }
    )

    expect(mocks.createSubsFindingsRulesMock).toHaveBeenCalled()
    expect(mocks.createSubsFindingsRulesMock).toHaveBeenCalledWith({
      capitalizationTerms: ["OpenAI"],
      properNouns: ["Taipei"],
      ignoreEmptyLines: true,
    })
    expect(mocks.createSubsMetricsRulesMock).not.toHaveBeenCalled()
  })

  it("uses shared subs metrics assembly for subs metrics mode", async () => {
    await buildMetricsOutput(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", ruleFilters: ["MAX_CPS"] }
    )

    expect(mocks.createSubsMetricsRulesMock).toHaveBeenCalledWith({
      capitalizationTerms: ["OpenAI"],
      properNouns: ["Taipei"],
      ignoreEmptyLines: undefined,
      enabledFindingTypes: ["MAX_CPS"],
    })
    expect(mocks.createSubsFindingsRulesMock).not.toHaveBeenCalled()
  })
})
