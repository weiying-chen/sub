import { describe, it, expect } from "vitest"

import { parseSegmentsArgs } from "../src/cli/segmentsArgs"

describe("segments CLI args", () => {
  it("parses type, text, and segment filter", () => {
    const args = parseSegmentsArgs([
      "--type",
      "news",
      "--segment",
      "2",
      "--text",
      "hello",
    ])

    expect(args.type).toBe("news")
    expect(args.segmentIndex).toBe(2)
    expect(args.textArg).toBe("hello")
  })

  it("parses compact output flag", () => {
    const args = parseSegmentsArgs(["--compact", "-t", "x"])
    expect(args.compact).toBe(true)
  })

  it("defaults to subs with pretty output", () => {
    const args = parseSegmentsArgs(["-t", "x"])
    expect(args.type).toBe("subs")
    expect(args.compact).toBe(false)
  })
})
