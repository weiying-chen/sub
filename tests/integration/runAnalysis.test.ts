import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import path from "node:path"

import type { Metric } from "../../src/analysis/types"
import { runAnalysis } from "../../src/cli/runAnalysis"

describe("runAnalysis integration fixtures", () => {
  it("treats empty lines as breaks between identical translations", async () => {
    const fixturePath = path.join(
      __dirname,
      "fixtures",
      "subs-empty-gap.txt"
    )
    const text = await readFile(fixturePath, "utf8")

    const output = (await runAnalysis(text, {
      type: "subs",
    })) as Metric[]

    const cps = output.filter((metric) => metric.type === "CPS")
    expect(cps.map((metric) => metric.lineIndex)).toEqual([1, 4, 6])
  })
})
