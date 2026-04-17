import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("index.html title", () => {
  it("uses Subtitle Checker as the document title", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8")
    expect(html).toContain("<title>Subtitle Checker</title>")
  })
})
