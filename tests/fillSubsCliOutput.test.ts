import { describe, it, expect } from "vitest"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const CLI_FILE = fileURLToPath(new URL("../src/cli/fillSubs.ts", import.meta.url))

describe("fill-subs CLI output shape", () => {
  it("does not add an extra blank line around an existing separator", () => {
    const input = [
      "00:03:41:12\t00:03:42:12\t然後你如果說",
      "00:03:42:12\t00:03:44:05\t你手會痠也沒關係",
      "",
      "00:03:44:05\t00:03:45:29\t手會痠我們就放下來",
      "00:03:45:29\t00:03:48:25\t也可以繼續做搖擺",
      "",
    ].join("\n")

    const run = spawnSync(
      CLI_FILE,
      ["-t", "And if your arms feel sore, that's okay."],
      {
        input,
        encoding: "utf8",
      }
    )

    expect(run.status).toBe(0)
    expect(run.stderr).toBe("")
    expect(run.stdout).not.toContain("\n\n\n")
    expect(run.stdout.endsWith("\n\n")).toBe(false)
  })
})
