import { describe, it, expect } from "vitest"
import { fillSelectedTimestampLines } from "../src/shared/fillSubs"

describe("fillSelectedTimestampLines", () => {
  it("fills selected timestamps and returns leftover", () => {
  const lines = [
    "00:00:11:00\t00:00:12:00\tNo blank",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(lines, selected, "One two three four", {
    maxChars: 10,
  })

  expect(result.lines).toEqual([
    "00:00:11:00\t00:00:12:00\tNo blank",
    "One two",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "three",
    "",
  ])
  expect(result.remaining).toBe("four")
  })

  it("skips timestamps that already have subtitle text below", () => {
  const lines = [
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "Hello world")

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
    "Hello world",
  ])
  expect(result.remaining).toBe("")
  })

  it("ignores blank lines when deciding whether to fill", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "One two three", {
    maxChars: 10,
  })

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "One two",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
    "three",
  ])
  expect(result.remaining).toBe("")
  })
})
