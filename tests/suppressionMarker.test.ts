import { describe, expect, it } from "vitest"

import { stripSuppressionMarker } from "../src/shared/suppressionMarker"

describe("stripSuppressionMarker", () => {
  it("strips only standalone trailing hash markers", () => {
    expect(stripSuppressionMarker("Hello #")).toEqual({
      text: "Hello",
      hasMarker: true,
    })
    expect(stripSuppressionMarker("Hello\t#  ")).toEqual({
      text: "Hello",
      hasMarker: true,
    })
    expect(stripSuppressionMarker("C# is a language")).toEqual({
      text: "C# is a language",
      hasMarker: false,
    })
    expect(stripSuppressionMarker("#hashtag")).toEqual({
      text: "#hashtag",
      hasMarker: false,
    })
  })
})
