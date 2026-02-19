import { describe, it, expect } from "vitest"

import { parseBlockAt, mergeForward, mergedRunPayloadIndices } from "../src/shared/tsvRuns"

const makeSrc = (lines: string[]) => ({
  lineCount: lines.length,
  getLine: (i: number) => lines[i] ?? "",
})

describe("tsvRuns empty-line handling", () => {
  it("treats empty lines as payload breaks by default", () => {
    const lines = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "",
      "Hello after gap.",
    ]

    const block = parseBlockAt(makeSrc(lines), 0)

    expect(block).toBeNull()
  })

  it("can ignore empty lines when opted in", () => {
    const lines = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "",
      "Hello after gap.",
    ]

    const block = parseBlockAt(makeSrc(lines), 0, { ignoreEmptyLines: true })

    expect(block?.payloadText).toBe("Hello after gap.")
    expect(block?.payloadIndex).toBe(2)
  })

  it("breaks merged runs across empty lines by default", () => {
    const lines = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Bye",
    ]

    const src = makeSrc(lines)
    const first = parseBlockAt(src, 0)

    expect(first).not.toBeNull()
    if (!first) return

    const run = mergeForward(src, first)

    expect(run.endTsIndex).toBe(first.tsIndex)
    expect(run.payloadText).toBe("Hi")
  })

  it("merges across empty lines when opted in", () => {
    const lines = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "Hi",
      "",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Hi",
      "00:00:03:00\t00:00:04:00\tMarker",
      "Bye",
    ]

    const src = makeSrc(lines)
    const first = parseBlockAt(src, 0, { ignoreEmptyLines: true })

    expect(first).not.toBeNull()
    if (!first) return

    const run = mergeForward(src, first, { ignoreEmptyLines: true })

    expect(run.endTsIndex).toBe(3)
    expect(run.payloadText).toBe("Hi")
  })

  it("returns payload indices only for merged runs", () => {
    const lines = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "Gap text.",
      "00:00:10:00\t00:00:11:00\tMarker",
      "Gap text.",
      "00:00:11:00\t00:00:12:00\tMarker",
      "Other text.",
    ]

    const src = makeSrc(lines)
    const first = parseBlockAt(src, 0)

    expect(first).not.toBeNull()
    if (!first) return

    const payloadIndices = mergedRunPayloadIndices(src, first)
    expect(payloadIndices).toEqual([1, 3])
  })
})
