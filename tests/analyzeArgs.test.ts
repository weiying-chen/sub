import { describe, it, expect } from "vitest"
import { parseAnalyzeArgs } from "../src/cli/analyzeArgs"

describe("analyze CLI args", () => {
  it("parses --text argument", () => {
    const args = parseAnalyzeArgs(["--text", "Hello world."])
    expect(args.textArg).toBe("Hello world.")
  })

  it("parses -t argument", () => {
    const args = parseAnalyzeArgs(["-t", "Short line."])
    expect(args.textArg).toBe("Short line.")
  })

  it("parses --mode findings", () => {
    const args = parseAnalyzeArgs(["--mode", "findings", "-t", "x"])
    expect(args.mode).toBe("findings")
  })

  it("defaults mode to metrics", () => {
    const args = parseAnalyzeArgs(["-t", "x"])
    expect(args.mode).toBe("metrics")
  })
})
