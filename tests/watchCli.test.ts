import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import { normalizeRuleFilters } from "../src/cli/watchRuleFilters"
import { shouldRunForWatchEvent } from "../src/cli/watchEvents"

describe("watch CLI rule filters", () => {
  it("reruns for changes and post-startup file replacements", () => {
    expect(shouldRunForWatchEvent("change", false)).toBe(true)
    expect(shouldRunForWatchEvent("add", false)).toBe(false)
    expect(shouldRunForWatchEvent("add", true)).toBe(true)
    expect(shouldRunForWatchEvent("unlink", true)).toBe(false)
  })

  it("treats an empty rule filter list as undefined", () => {
    expect(normalizeRuleFilters([])).toBeUndefined()
  })

  it("preserves explicit rule filters", () => {
    expect(normalizeRuleFilters(["MAX_CPS"])).toEqual(["MAX_CPS"])
  })

  it("runs once and exits with the human reporter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watch-once-"))
    const filePath = join(dir, "sample.txt")
    await writeFile(
      filePath,
      [
        "00:00:01:00\t00:00:02:00\t標記",
        "Marker.",
      ].join("\n"),
      "utf8"
    )

    const result = spawnSync(
      "node_modules/.bin/tsx",
      ["src/cli/watch.ts", "--once", filePath, "--type", "subs"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 5000,
      }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("OK")
  })
})
