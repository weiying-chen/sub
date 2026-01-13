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

  it("fills trailing slots with the last line", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
    "00:00:04:00\t00:00:05:00\tMarker",
  ]
  const selected = new Set([0, 1, 2, 3, 4])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Short line that should not reach the end.",
    { maxChars: 100, inline: true }
  )

  expect(result.lines).toEqual([
    "00:00:00:00\t00:00:01:00\tMarker",
    "Short line that should not reach the end.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "Short line that should not reach the end.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "Short line that should not reach the end.",
    "00:00:03:00\t00:00:04:00\tMarker",
    "Short line that should not reach the end.",
    "00:00:04:00\t00:00:05:00\tMarker",
    "Short line that should not reach the end.",
  ])
  expect(result.remaining).toBe("")
  })

  it("respects the minimum CPS floor", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1, 2])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Short text.",
    { maxChars: 100, inline: true }
  )

  expect(result.chosenCps).toBeGreaterThanOrEqual(10)
  })

  it("caps the span count per line", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
    "00:00:04:00\t00:00:05:00\tMarker",
    "00:00:05:00\t00:00:06:00\tMarker",
  ]
  const selected = new Set([0, 1, 2, 3, 4, 5])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Alpha beta gamma delta epsilon zeta.",
    { maxChars: 12, inline: true }
  )

  const payloads = result.lines.filter(
    (line) => line.trim() !== "" && !/^\d{2}:\d{2}:\d{2}:\d{2}\t/.test(line)
  )
  let maxRun = 0
  let run = 0
  let last = ""
  for (const payload of payloads) {
    if (payload === last) {
      run += 1
    } else {
      run = 1
      last = payload
    }
    if (run > maxRun) maxRun = run
  }
  expect(maxRun).toBeLessThanOrEqual(3)
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

  it("prefers breaking before copular verb phrases", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "And one last thing you can do is give your partner the right kind of support.",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "And one last thing you can do is",
    "give your partner the right kind of support.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("avoids splitting 'even so'", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Even so, it can be hard at times.",
    { maxChars: 8, inline: false }
  )

  expect(result.lines).toEqual([
    "Even so,",
    "it can",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("be hard at times.")
  })

  it("splits before clause-starting ', and'", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Even so, becoming a father hasn't been easy, and I've had a lot of setbacks.",
    { maxChars: 50, inline: false }
  )

  expect(result.lines).toEqual([
    "Even so, becoming a father hasn't been easy,",
    "and I've had a lot of setbacks.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits fragment before a new sentence", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "breather. My wife does this all the time.",
    { maxChars: 35, inline: false }
  )

  expect(result.lines).toEqual([
    "breather.",
    "My wife does this all the time.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps full sentences together on one line", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "It is true. My wife does this all the time.",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "It is true. My wife does this all the time.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("forces split on fragment + new sentence even under maxChars", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "breather. My wife does this all the time.",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "breather.",
    "My wife does this all the time.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("respects maxChars when remaining starts lowercase", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
  ]
  const selected = new Set([0, 1, 2])

  const maxChars = 30
  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "My dad was always busy, and looking back, we hardly ever really talked. By the time he retired, I was the busy one.",
    { maxChars, inline: true }
  )

  const payloads = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  for (const payload of payloads) {
    expect(payload.length).toBeLessThanOrEqual(maxChars)
  }
  })

  it("carries quotes across repeated spans", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1, 2])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    '"Hello there."',
    { maxChars: 100, inline: true }
  )

  expect(result.lines).toEqual([
    "00:00:00:00\t00:00:01:00\tMarker",
    '"Hello there."',
    "00:00:01:00\t00:00:02:00\tMarker",
    '"Hello there."',
    "00:00:02:00\t00:00:03:00\tMarker",
    '"Hello there."',
  ])
  expect(result.remaining).toBe("")
  })
})
