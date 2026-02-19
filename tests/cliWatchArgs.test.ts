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
    })
  })

  it("disables warnings with --no-warn", () => {
    const result = parseArgs(["--no-warn", "file.txt"])
    expect(result).toMatchObject({
      filePath: "file.txt",
      type: "subs",
      includeWarnings: false,
      baselinePath: null,
    })
  })
})
