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

  it("includes BASELINE and excludes non-default rules in shared defaults", () => {
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).toContain("BASELINE")
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).not.toContain("CPS_BALANCE")
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).not.toContain("CAPITALIZATION")
    expect(DEFAULT_SUBS_FINDING_RULE_TYPES).not.toContain("LEADING_WHITESPACE")
  })
})
