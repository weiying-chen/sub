import { describe, it, expect } from "vitest"

import { parseBlockAt, mergeForward, mergedRunTranslationIndices } from "../src/shared/tsvRuns"

const makeSrc = (lines: string[]) => ({
  lineCount: lines.length,
  getLine: (i: number) => lines[i] ?? "",
})

describe("tsvRuns empty-line handling", () => {
  it("treats empty lines as translation breaks by default", () => {
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

    expect(block?.translation).toBe("Hello after gap.")
    expect(block?.translationIndex).toBe(2)
  })

  it("ignores comment lines before and after subtitle translations", () => {
    const lines = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "// translator note",
      "Hello after comment",
      "// source note",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Next line.",
    ]

    const block = parseBlockAt(makeSrc(lines), 0)

    expect(block?.translation).toBe("Hello after comment")
    expect(block?.translationIndex).toBe(2)
    expect(block?.translationLines).toEqual(["Hello after comment"])
    expect(block?.translationIndices).toEqual([2])
  })

  it("keeps wrapped subtitle lines together even when the first line ends a sentence", () => {
    const lines = [
      "00:00:10:00\t00:00:11:13\t而是一團星星",
      "might actually be a galaxy?",
      "Which galaxy is visible from Taiwan?",
      "galaxy is visible from Taiwan?",
      "visible from Taiwan?",
    ]

    const block = parseBlockAt(makeSrc(lines), 0)

    expect(block?.translation).toBe(
      "might actually be a galaxy?Which galaxy is visible from Taiwan?galaxy is visible from Taiwan?visible from Taiwan?"
    )
    expect(block?.translationLines).toEqual([
      "might actually be a galaxy?",
      "Which galaxy is visible from Taiwan?",
      "galaxy is visible from Taiwan?",
      "visible from Taiwan?",
    ])
  })

  it("stops a translation block at a standalone XXX line", () => {
    const lines = [
      "00:00:10:00\t00:00:11:13\t而是一團星星",
      "might actually be a galaxy?",
      "XXX",
      "Which galaxy is visible from Taiwan?",
    ]

    const block = parseBlockAt(makeSrc(lines), 0)

    expect(block?.translation).toBe("might actually be a galaxy?")
    expect(block?.translationLines).toEqual(["might actually be a galaxy?"])
    expect(block?.translationIndices).toEqual([1])
  })

  it("does not treat untimestamped text after XXX as a subtitle block", () => {
    const lines = [
      "XXX",
      "Which galaxy is visible from Taiwan?",
    ]

    const block = parseBlockAt(makeSrc(lines), 0)

    expect(block).toBeNull()
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
    expect(run.translation).toBe("Hi")
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
    expect(run.translation).toBe("Hi")
  })

  it("returns translation indices only for merged runs", () => {
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

    const translationIndices = mergedRunTranslationIndices(src, first)
    expect(translationIndices).toEqual([1, 3])
  })
})
