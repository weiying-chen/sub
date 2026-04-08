import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const CLI_FILE_URL = new URL("../src/cli/fillSubs.ts", import.meta.url)

describe("fill-subs executable entry", () => {
  it("uses an executable tsx-based shebang", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    const firstLine = source.split(/\r?\n/, 1)[0]

    expect(firstLine.startsWith("#!")).toBe(true)
    const isNodeLoader = firstLine.includes("node --import") && firstLine.includes("tsx/dist/loader.mjs")
    const isTsxBinary = firstLine.includes("node_modules/.bin/tsx")
    expect(isNodeLoader || isTsxBinary).toBe(true)
  })

  it("supports overflow-to-clipboard runtime option", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    expect(source).toContain("overflowToClipboard")
    expect(source).toContain("setClipboardText(remaining)")
  })

  it("routes overflow display to /dev/tty when available", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    expect(source).toContain("/dev/tty")
  })

  it("uses timeouts for clipboard commands", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    expect(source).toContain("CLIPBOARD_CMD_TIMEOUT_MS")
    expect(source).toContain("timeout: CLIPBOARD_CMD_TIMEOUT_MS")
  })

  it("does not use legacy env fallbacks for runtime options", () => {
    const source = readFileSync(CLI_FILE_URL, "utf8")
    expect(source).not.toContain("process.env.SHOW_OVERFLOW")
    expect(source).not.toContain("process.env.OVERFLOW_TO_CLIPBOARD")
    expect(source).not.toContain("process.env.MAX_LEN")
    expect(source).not.toContain("process.env.MAX_CHARS")
  })
})
