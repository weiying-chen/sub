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
    inline: false,
  })

  expect(result.lines).toEqual([
    "One two",
    "three four",
    "00:00:11:00\t00:00:12:00\tNo blank",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "",
  ])
  expect(result.remaining).toBe("")
  })

  it("skips timestamps that already have subtitle text below", () => {
  const lines = [
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "Hello world", {
    inline: false,
  })

  expect(result.lines).toEqual([
    "Hello world",
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
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
    inline: false,
  })

  expect(result.lines).toEqual([
    "One two",
    "three",
    "00:00:01:00\t00:00:02:00\tMarker",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps trailing quote with punctuation", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    'He said, "hello." Then left.',
    { maxChars: 18, inline: false }
  )

  expect(result.lines).toEqual([
    'He said, "hello."',
    "Then left.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("supports inline mode when requested", () => {
  const lines = [
    "00:00:11:00\t00:00:12:00\tNo blank",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "One two three four",
    { maxChars: 10, inline: true }
  )

  expect(result.lines).toEqual([
    "00:00:11:00\t00:00:12:00\tNo blank",
    "One two",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "three four",
    "",
  ])
  expect(result.remaining).toBe("")
  })

  it("adjusts target CPS to fill all slots when possible", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1, 2])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "This is twenty chars",
    { maxChars: 100, inline: true }
  )

  expect(result.lines).toEqual([
    "00:00:00:00\t00:00:01:00\tMarker",
    "This is twenty chars",
    "00:00:01:00\t00:00:02:00\tMarker",
    "This is twenty chars",
    "00:00:02:00\t00:00:03:00\tMarker",
    "This is twenty chars",
  ])
  expect(result.remaining).toBe("")
  })

  it("chooses the CPS that fills the most slots without overflow", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
  ]
  const selected = new Set([0, 1, 2, 3])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Too long for four short slots.",
    { maxChars: 100, inline: true }
  )

  expect(result.lines).toEqual([
    "00:00:00:00\t00:00:01:00\tMarker",
    "Too long for four short slots.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "Too long for four short slots.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "Too long for four short slots.",
    "00:00:03:00\t00:00:04:00\tMarker",
    "Too long for four short slots.",
  ])
  expect(result.remaining).toBe("")
  })

  it("avoids splitting list items at commas", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Let him know that feeling frustrated, sad, or worn out is normal.",
    { maxChars: 54, inline: false }
  )

  expect(result.lines).toEqual([
    "Let him know",
    "that feeling frustrated, sad, or worn out is normal.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })
})
