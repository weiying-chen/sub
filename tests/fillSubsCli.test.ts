import { describe, it, expect } from "vitest"

import { parseFillSubsArgs } from "../src/cli/fillSubsCore"

describe("fill-subs CLI args", () => {
  it("parses paragraph argument", () => {
    const args = parseFillSubsArgs(["--text", "Hello world."])
    expect(args).toMatchObject({
      paragraphArg: "Hello world.",
      inline: true,
    })
  })

  it("supports short paragraph flag", () => {
    const args = parseFillSubsArgs(["-t", "Short line."])
    expect(args.paragraphArg).toBe("Short line.")
  })
})
