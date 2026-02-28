import { describe, it, expect } from "vitest"

import { parseInspectArgs } from "../src/cli/inspectArgs"

describe("inspect CLI args", () => {
  it("parses type, text, and segment filter", () => {
    const args = parseInspectArgs([
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
    const args = parseInspectArgs(["--compact", "-t", "x"])
    expect(args.compact).toBe(true)
  })

  it("defaults to subs with pretty output", () => {
    const args = parseInspectArgs(["-t", "x"])
    expect(args.type).toBe("subs")
    expect(args.compact).toBe(false)
  })
})
