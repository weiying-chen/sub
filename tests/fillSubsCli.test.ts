import { describe, it, expect } from "vitest"

import { parseFillSubsArgs } from "../src/cli/fillSubsCore"

describe("fill-subs CLI args", () => {
  it("parses paragraph argument", () => {
    const args = parseFillSubsArgs(["--text", "Hello world."])
    expect(args).toMatchObject({
      paragraphArg: "Hello world.",
    })
  })

  it("supports short paragraph flag", () => {
    const args = parseFillSubsArgs(["-t", "Short line."])
    expect(args.paragraphArg).toBe("Short line.")
  })

  it("parses alt break flag", () => {
    const args = parseFillSubsArgs(["--alt-break"])
    expect(args.altBreak).toBe(true)
  })

  it("does not expose deprecated inline args", () => {
    const args = parseFillSubsArgs(["--no-inline"])
    expect("inline" in args).toBe(false)
  })
})
