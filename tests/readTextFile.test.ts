import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { readTextFile } from "../src/cli/readTextFile"

describe("readTextFile", () => {
  it("decodes UTF-16 little-endian files with a BOM", async () => {
    const directory = await mkdtemp(join(tmpdir(), "read-text-file-"))
    const path = join(directory, "drama.txt")
    const content = "00:00:01:00\t00:00:02:00\t你看\r\nLook.\r\n"
    const utf16le = Buffer.from(content, "utf16le")
    await writeFile(path, Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le]))

    expect(await readTextFile(path)).toBe(content)
  })

  it("decodes UTF-8 files and removes their BOM", async () => {
    const directory = await mkdtemp(join(tmpdir(), "read-text-file-"))
    const path = join(directory, "baseline.txt")
    await writeFile(path, Buffer.from("\uFEFF你看\n", "utf8"))

    expect(await readTextFile(path)).toBe("你看\n")
  })
})
