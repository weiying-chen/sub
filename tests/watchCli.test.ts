import { describe, expect, it } from "vitest"

import { normalizeRuleFilters } from "../src/cli/watchRuleFilters"

describe("watch CLI rule filters", () => {
  it("treats an empty rule filter list as undefined", () => {
    expect(normalizeRuleFilters([])).toBeUndefined()
  })

  it("preserves explicit rule filters", () => {
    expect(normalizeRuleFilters(["MAX_CPS"])).toEqual(["MAX_CPS"])
  })
})
