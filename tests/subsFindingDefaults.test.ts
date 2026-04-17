import { describe, expect, it } from "vitest"

import {
  DEFAULT_SUBS_FINDING_RULE_TYPES,
  resolveSubsFindingRuleFilters,
} from "../src/analysis/subsFindingDefaults"

describe("subs finding defaults", () => {
  it("returns shared defaults when no filters are provided", () => {
    expect(resolveSubsFindingRuleFilters(undefined)).toEqual(DEFAULT_SUBS_FINDING_RULE_TYPES)
    expect(resolveSubsFindingRuleFilters([])).toEqual(DEFAULT_SUBS_FINDING_RULE_TYPES)
  })

  it("keeps explicit filters when provided", () => {
    expect(resolveSubsFindingRuleFilters(["MAX_CPS"])).toEqual(["MAX_CPS"])
  })

  it("uses the agreed demo default rule set", () => {
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).toEqual([
      "MAX_CHARS",
      "BLOCK_STRUCTURE",
      "TIMESTAMP_FORMAT",
      "LEADING_WHITESPACE",
      "SPAN_GAP",
      "MERGE_CANDIDATE",
      "JOINABLE_BREAK",
      "CAPITALIZATION",
      "DASH_STYLE",
      "PERCENT_STYLE",
      "NUMBER_STYLE",
      "PUNCTUATION",
      "MAX_CPS",
      "MIN_CPS",
      "BASELINE",
    ])
  })

  it("does not include cps-balance by default", () => {
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).not.toContain("CPS_BALANCE")
  })
})
