import { describe, it, expect } from "vitest"
import { normalizeParagraph } from "../src/shared/fillSubs"

describe("normalizeParagraph", () => {
  it("replaces em dashes with triple hyphens", () => {
    expect(normalizeParagraph("Wait—what")).toBe("Wait---what")
  })

  it("replaces en dashes with triple hyphens", () => {
    expect(normalizeParagraph("heart–lung")).toBe("heart---lung")
  })

  it("normalizes curly quotes to straight quotes", () => {
    expect(normalizeParagraph("“Don’t do that,” she said.")).toBe(
      "\"Don't do that,\" she said."
    )
  })
})
