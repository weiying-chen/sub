import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const CLI_FILE_URL = new URL("../src/cli/fillSubs.ts", import.meta.url)

describe("fill-subs executable entry", () => {
  it("uses node with a tsx loader shebang", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    const firstLine = source.split(/\r?\n/, 1)[0]

    expect(firstLine.startsWith("#!")).toBe(true)
    expect(firstLine).toContain("node --import")
    expect(firstLine).toContain("tsx/dist/loader.mjs")
  })
})
