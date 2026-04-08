import { describe, it, expect } from "vitest"

import { parseFillSubsArgs } from "../src/cli/fillSubsCore"

describe("fill-subs CLI args", () => {
  it("parses input and output flags", () => {
    const args = parseFillSubsArgs([
      "-i",
      "input.tsv",
      "--out",
      "output.tsv",
    ])

    expect(args.inputFile).toBe("input.tsv")
    expect(args.outputFile).toBe("output.tsv")
  })

  it("parses long input and output aliases", () => {
    const args = parseFillSubsArgs([
      "--in",
      "source.tsv",
      "-o",
      "dest.tsv",
    ])

    expect(args.inputFile).toBe("source.tsv")
    expect(args.outputFile).toBe("dest.tsv")
  })

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

  it("parses max chars and overflow flags", () => {
    const args = parseFillSubsArgs([
      "--max-chars",
      "42",
      "--show-overflow",
      "--overflow-to-clipboard",
    ])

    expect(args.maxChars).toBe(42)
    expect(args.showOverflow).toBe(true)
    expect(args.overflowToClipboard).toBe(true)
  })

  it("parses max chars equals form", () => {
    const args = parseFillSubsArgs(["--max-chars=48"])
    expect(args.maxChars).toBe(48)
  })

  it("parses no-overflow flag variants", () => {
    const args = parseFillSubsArgs([
      "--no-show-overflow",
      "--no-overflow-to-clipboard",
    ])

    expect(args.showOverflow).toBe(false)
    expect(args.overflowToClipboard).toBe(false)
  })
})
