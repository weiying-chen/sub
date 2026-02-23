import { describe, it, expect } from "vitest"
import { parseMetricsArgs } from "../src/cli/metricsArgs"

describe("metrics CLI args", () => {
  it("parses --text argument", () => {
    const args = parseMetricsArgs(["--text", "Hello world."])
    expect(args.textArg).toBe("Hello world.")
  })

  it("parses -t argument", () => {
    const args = parseMetricsArgs(["-t", "Short line."])
    expect(args.textArg).toBe("Short line.")
  })

  it("parses --mode findings", () => {
    const args = parseMetricsArgs(["--mode", "findings", "-t", "x"])
    expect(args.mode).toBe("findings")
  })

  it("defaults mode to metrics", () => {
    const args = parseMetricsArgs(["-t", "x"])
    expect(args.mode).toBe("metrics")
  })
})
