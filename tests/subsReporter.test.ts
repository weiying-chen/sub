import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  buildAnalyzeOutputMock: vi.fn(async () => []),
  sortFindingsWithIndexMock: vi.fn((findings: any[]) =>
    findings.map((finding, index) => ({ finding, index }))
  ),
}))

vi.mock("../src/cli/analyzeOutput", () => ({
  buildAnalyzeOutput: mocks.buildAnalyzeOutputMock,
}))

vi.mock("../src/shared/findingsSort", () => ({
  sortFindingsWithIndex: mocks.sortFindingsWithIndexMock,
}))

import { createSubsReporter } from "../src/cli/subs"

describe("createSubsReporter", () => {
  beforeEach(() => {
    mocks.buildAnalyzeOutputMock.mockReset()
    mocks.buildAnalyzeOutputMock.mockResolvedValue([])
    mocks.sortFindingsWithIndexMock.mockClear()
  })

  it("uses shared analyze output path for subs findings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "subs-reporter-"))
    const filePath = join(dir, "sample.txt")
    await writeFile(
      filePath,
      [
        "00:05:19:06\t00:05:21:20\t今年非常不幸地",
        "Unfortunately, this year,",
        "00:05:21:20\t00:05:24:03\t帥老哥的太太過世了",
        "Mr. Handsome's wife passed away.",
      ].join("\n"),
      "utf8"
    )

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      const reporter = createSubsReporter({ includeWarnings: true })
      await reporter(filePath, { clearScreen: () => {} })
    } finally {
      logSpy.mockRestore()
    }

    expect(mocks.buildAnalyzeOutputMock).toHaveBeenCalledTimes(1)
    expect(mocks.buildAnalyzeOutputMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: "subs",
        mode: "findings",
        includeWarnings: true,
      })
    )
  })

  it("filters findings by marker scope after shared analysis", async () => {
    mocks.buildAnalyzeOutputMock.mockResolvedValue([
      { type: "MAX_CHARS", lineIndex: 0, severity: "error" },
      { type: "MAX_CHARS", lineIndex: 3, severity: "error" },
    ])

    const dir = await mkdtemp(join(tmpdir(), "subs-reporter-"))
    const filePath = join(dir, "sample-scope.txt")
    await writeFile(
      filePath,
      [
        "Outside scope line",
        "@@",
        "00:05:19:06\t00:05:21:20\t今年非常不幸地",
        "Unfortunately, this year,",
        "",
      ].join("\n"),
      "utf8"
    )

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      const reporter = createSubsReporter({ includeWarnings: true })
      await reporter(filePath, { clearScreen: () => {} })
    } finally {
      logSpy.mockRestore()
    }

    expect(mocks.sortFindingsWithIndexMock).toHaveBeenCalledTimes(1)
    const scoped = mocks.sortFindingsWithIndexMock.mock.calls[0]?.[0] as any[]
    expect(scoped).toHaveLength(1)
    expect(scoped[0]?.lineIndex).toBe(3)
  })
})
