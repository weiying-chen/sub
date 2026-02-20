import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createSubsSegmentRulesMock: vi.fn(() => []),
}))

vi.mock("../src/analysis/subsSegmentRules", () => ({
  createSubsSegmentRules: mocks.createSubsSegmentRulesMock,
}))

vi.mock("../src/cli/properNouns", () => ({
  loadCapitalizationTerms: vi.fn(async () => ["OpenAI"]),
  loadProperNouns: vi.fn(async () => ["Taipei"]),
}))

import { buildMetricsOutput } from "../src/cli/metricsCore"

describe("metricsCore rule assembly", () => {
  beforeEach(() => {
    mocks.createSubsSegmentRulesMock.mockClear()
  })

  it("uses shared subs segment rule assembly for subs type", async () => {
    await buildMetricsOutput(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", findingsOnly: true, ignoreEmptyLines: true }
    )

    expect(mocks.createSubsSegmentRulesMock).toHaveBeenCalled()
    expect(mocks.createSubsSegmentRulesMock).toHaveBeenCalledWith({
      capitalizationTerms: ["OpenAI"],
      properNouns: ["Taipei"],
      ignoreEmptyLines: true,
    })
  })

  it("passes rule filters into shared subs rule assembly", async () => {
    await buildMetricsOutput(
      [
        "00:00:01:00\t00:00:02:00\tMarker",
        "Hello.",
      ].join("\n"),
      { type: "subs", ruleFilters: ["MAX_CHARS"] }
    )

    expect(mocks.createSubsSegmentRulesMock).toHaveBeenCalledWith({
      capitalizationTerms: ["OpenAI"],
      properNouns: ["Taipei"],
      ignoreEmptyLines: undefined,
      enabledFindingTypes: ["MAX_CHARS"],
    })
  })
})
