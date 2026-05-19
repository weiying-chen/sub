import { describe, expect, it } from "vitest"

import { parseArgs } from "../src/cli/watchArgs"

describe("watch parseArgs", () => {
  it("defaults to showing warnings", () => {
    const result = parseArgs(["file.txt"])
    expect(result).toMatchObject({
      filePath: "file.txt",
      type: "subs",
      includeWarnings: true,
      baselinePath: null,
      maxCps: null,
    })
  })

  it("disables warnings with --no-warn", () => {
    const result = parseArgs(["--no-warn", "file.txt"])
    expect(result).toMatchObject({
      filePath: "file.txt",
      type: "subs",
      includeWarnings: false,
      baselinePath: null,
      maxCps: null,
    })
  })

  it("parses repeated --rule filters", () => {
    const result = parseArgs([
      "--rule",
      "MAX_CHARS",
      "--rule=PUNCTUATION",
      "file.txt",
    ])
    expect(result.ruleFilters).toEqual(["MAX_CHARS", "PUNCTUATION"])
  })

  it("parses --max-cps value", () => {
    const result = parseArgs(["--max-cps", "19", "file.txt"])
    expect(result.maxCps).toBe(19)
  })

  it("parses --min-cps value", () => {
    const result = parseArgs(["--min-cps", "6", "file.txt"])
    expect(result.minCps).toBe(6)
  })
})
