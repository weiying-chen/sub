import { describe, expect, it } from "vitest"

import { resolveWatchProfile } from "../src/cli/watchProfiles"

describe("resolveWatchProfile", () => {
  it("uses subtitle checks with a 50-character limit for dramas", () => {
    expect(resolveWatchProfile("dramas")).toEqual({
      type: "dramas",
      reporter: "subs",
      label: "(dramas)",
      maxChars: 50,
      supportsBaseline: true,
    })
  })

  it("keeps the normal subtitle character limit unchanged", () => {
    expect(resolveWatchProfile("subs")).toMatchObject({
      reporter: "subs",
      maxChars: undefined,
      supportsBaseline: true,
    })
  })
})
