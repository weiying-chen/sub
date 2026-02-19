import { describe, expect, it } from "vitest"

import { resolveFindingIdAtPos, type FindingRange } from "../src/cm/findingSelection"

describe("resolveFindingIdAtPos", () => {
  it("keeps preferred overlapping finding id", () => {
    const ranges: FindingRange[] = [
      { id: "error", from: 10, to: 40 },
      { id: "warn", from: 10, to: 40 },
    ]

    const out = resolveFindingIdAtPos(ranges, 15, "warn")
    expect(out).toBe("warn")
  })

  it("falls back to shortest overlap when preferred is not present", () => {
    const ranges: FindingRange[] = [
      { id: "broad", from: 10, to: 50 },
      { id: "token", from: 20, to: 25 },
    ]

    const out = resolveFindingIdAtPos(ranges, 22, null)
    expect(out).toBe("token")
  })
})
