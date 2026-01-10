import { describe, it, expect } from "vitest"
import { normalizeParagraph } from "../src/shared/fillSubs"

describe("normalizeParagraph", () => {
  it("replaces em dashes with triple hyphens", () => {
    expect(normalizeParagraph("Wait—what")).toBe("Wait---what")
  })
})
