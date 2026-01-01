import { describe, it, expect } from "vitest"

import { findMarkerScope } from "../src/cli/markerScope"

describe("findMarkerScope", () => {
  it("returns null when no marker is present", () => {
    const lines = ["00:00:01:00\t00:00:02:00\tSRC1", "Hello"]
    expect(findMarkerScope(lines)).toBeNull()
  })

  it("uses the last marker and stops at the next blank line", () => {
    const lines = [
      "@@",
      "00:00:01:00\t00:00:02:00\tSRC1",
      "",
      "@@",
      "00:00:03:00\t00:00:04:00\tSRC2",
      "payload",
      "",
      "tail",
    ]

    expect(findMarkerScope(lines)).toEqual({ start: 4, end: 5 })
  })

  it("extends to EOF when no blank line follows the marker", () => {
    const lines = [
      "intro",
      "@@",
      "00:00:01:00\t00:00:02:00\tSRC1",
      "payload",
    ]

    expect(findMarkerScope(lines)).toEqual({ start: 2, end: 3 })
  })

  it("returns null when the marker has no content below it", () => {
    const lines = ["intro", "@@", ""]
    expect(findMarkerScope(lines)).toBeNull()
  })
})
