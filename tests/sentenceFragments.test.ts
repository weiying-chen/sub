import { describe, expect, it } from "vitest"

import { looksLikeSentenceFragment } from "../src/shared/sentenceFragments"

describe("looksLikeSentenceFragment", () => {
  it("treats capitalized one-word replies with terminal punctuation as full sentences", () => {
    expect(looksLikeSentenceFragment("No.")).toBe(false)
    expect(looksLikeSentenceFragment("Yes.")).toBe(false)
    expect(looksLikeSentenceFragment("Why?")).toBe(false)
  })

  it("still treats lowercase one-word tails as fragments", () => {
    expect(looksLikeSentenceFragment("back.")).toBe(true)
    expect(looksLikeSentenceFragment("breather.")).toBe(true)
  })
})
