import { describe, it, expect } from "vitest"
import { __testTakeLine, fillSelectedTimestampLines } from "../src/shared/fillSubs"

const NO_SPLIT_ABBREVIATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "U.S.", "a.m.", "p.m."]

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

  it("moves the full final list item to the next line when it doesn't fit", () => {
  const split = __testTakeLine(
    "We reviewed budgets, timelines, or staffing constraints before launch.",
    44,
    null,
    false
  )

  expect(split.line).toBe("We reviewed budgets, timelines,")
  expect(split.rest).toBe("or staffing constraints before launch.")
  })

  it("avoids early comma splits on short lead-ins", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Next, we review the plan carefully before taking action.",
    { maxChars: 20, inline: false }
  )

  expect(result.lines).toEqual([
    "Next, we review the",
    "plan carefully",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("before taking action.")
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

  it("avoids splitting 'even though'", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Even though that was true, it was still hard.",
    { maxChars: 14, inline: false }
  )

  expect(result.lines).toEqual([
    "Even though",
    "that was true,",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("it was still hard.")
  })

  it("prefers splitting before 'on how'", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "We focused on how to do it.",
    { maxChars: 17, inline: false }
  )

  expect(result.lines).toEqual([
    "We focused on",
    "how to do it.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps 'like that' together", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "He laughed like that every time.",
    { maxChars: 24, inline: false }
  )

  expect(result.lines).toEqual([
    "He laughed like that",
    "every time.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("avoids splitting after abbreviations like Dr.", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Hi, I'm Dr. Chuang Chia-ying, a Chinese medicine doctor.",
    { maxChars: 54, inline: false, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )

  expect(result.lines).toEqual([
    "Hi, I'm Dr. Chuang Chia-ying,",
    "a Chinese medicine doctor.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before 'that' after reporting verbs", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "He told me that it was over.",
    { maxChars: 20, inline: false }
  )

  expect(result.lines).toEqual([
    "He told me",
    "that it was over.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("avoids starting a line with 'that' after noun phrases", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "He told me a story that moved me.",
    { maxChars: 20, inline: false }
  )

  expect(result.lines).toEqual([
    "He told me a story that",
    "moved me.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps conjunction with following 'that' clause", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "and that was enough.",
    { maxChars: 12, inline: false }
  )

  expect(result.lines).toEqual([
    "and that",
    "was enough.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("prefers splitting after 'that' before pronoun", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The biggest benefit is that it opens up my perspective.",
    { maxChars: 30, inline: false }
  )

  expect(result.lines).toEqual([
    "The biggest benefit is that",
    "it opens up my perspective.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("prefers splitting before relative who clauses", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "A Chinese American science fiction writer who's hugely respected in the U.S.",
    { maxChars: 54, inline: false, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )

  expect(result.lines).toEqual([
    "A Chinese American science fiction writer",
    "who's hugely respected in the U.S.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
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
    "Even so, becoming a caregiver hasn't been easy, and I've had a lot of setbacks.",
    { maxChars: 50, inline: false }
  )

  expect(result.lines).toEqual([
    "Even so, becoming a caregiver hasn't been easy,",
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

  it("splits after periods even for full sentences", () => {
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
    "It is true.",
    "My wife does this all the time.",
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
    "Our manager was always busy, and looking back, we hardly ever really talked. By the time he retired, I was the busy one.",
    { maxChars, inline: true }
  )

  const payloads = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  for (const payload of payloads) {
    expect(payload.length).toBeLessThanOrEqual(maxChars)
  }
  })

  it("splits at the first fragment boundary", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "and that chance was gone. He later moved away.",
    { maxChars: 54, inline: false }
  )

  expect(result.lines).toEqual([
    "and that chance was gone.",
    "He later moved away.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits after copular before clause starter", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The issue now is how to solve this quickly",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "The issue now is how to solve this quickly",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before copular when tail is not a clause", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The best exercise for older adults is simply walking",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "The best exercise for older adults is simply walking",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps copular with clause subject tail", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The truth is we need to leave",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "The truth is we need to leave",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits after to-verb phrase before object", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "We don't believe they have to follow the exact same path we did.",
    { maxChars: 50, inline: false }
  )

  expect(result.lines).toEqual([
    "We don't believe they have to follow",
    "the exact same path we did.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before 'with' as a low-priority fallback", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "They arrived at the station with extra supplies.",
    { maxChars: 34, inline: false }
  )

  expect(result.lines).toEqual([
    "They arrived at the station",
    "with extra supplies.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
  })

  it("avoids one-word heads when splitting before 'with'", () => {
  const split = __testTakeLine(
    "coping with outages, delays, or staffing shortages before recovery.",
    54,
    null,
    false
  )

  expect(split.line.toLowerCase()).toMatch(/^coping with\b/)
  expect(split.line.split(/\s+/).filter(Boolean).length).toBeGreaterThan(1)
  })

  it("keeps since-clause starter with its clause", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "I've been working at the lab since it was founded.",
    { maxChars: 50, inline: false }
  )

  expect(result.lines).toEqual([
    "I've been working at the lab since it was founded.",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("")
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

  it("avoids wrapping lines with inline quotes", () => {
  const lines = [
    "00:00:54:00\t00:00:55:10\tMarker",
    "00:00:55:10\t00:01:00:02\tMarker",
    "00:01:00:02\t00:01:04:15\tMarker",
    "00:01:04:15\t00:01:09:17\tMarker",
    "00:01:09:17\t00:01:12:17\tMarker",
    "00:01:12:17\t00:01:16:09\tMarker",
    "00:01:16:09\t00:01:17:27\tMarker",
    "00:01:17:27\t00:01:20:14\tMarker",
    "00:01:20:14\t00:01:23:14\tMarker",
    "00:01:23:14\t00:01:27:04\tMarker",
    "00:01:27:04\t00:01:28:07\tMarker",
    "00:01:28:07\t00:01:29:28\tMarker",
    "00:01:29:28\t00:01:33:06\tMarker",
    "00:01:33:06\t00:01:35:15\tMarker",
    "00:01:35:15\t00:01:37:11\tMarker",
    "00:01:37:11\t00:01:39:26\tMarker",
    "00:01:39:26\t00:01:41:02\tMarker",
    "00:01:41:02\t00:01:45:18\tMarker",
    "00:01:45:18\t00:01:51:06\tMarker",
    "00:01:51:06\t00:01:54:26\tMarker",
    "00:01:54:26\t00:01:58:22\tMarker",
    "00:01:58:22\t00:02:01:20\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    'I recall a time in Harbor Town. I recall a time in Harbor Town. I arrived at dusk and knocked on the half-open door. I arrived at dusk and knocked on the half-open door. A voice inside said, "Just push it. You can come in." The place was in terrible shape, a straw hut with a bamboo door. a straw hut with a bamboo door. Inside it was pitch dark. He said, "Reach out and you\'ll hit the light." He said, "Reach out and you\'ll hit the light." The bulb was hanging down, The bulb was hanging down, and when I turned it on it was just five watts, and when I turned it on it was just five watts, and when I turned it on it was just five watts, barely lighting the room. barely lighting the room. By the wall was a bamboo bed with straw on top, By the wall was a bamboo bed with straw on top, and a middle-aged man lay there. and a middle-aged man lay there.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: true,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).toContain('A voice inside said, "Just push it."')
  expect(payloads).not.toContain('"A voice inside said, "Just push it."')
  })

  it("adds quotes when splitting inside a quoted span in non-inline mode", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    'He said "This is a long quote that should split in the middle." Then left.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 24,
    inline: false,
  })
  const payloads = result.lines.slice(0, 2)

  expect(payloads[0]?.endsWith('"')).toBe(true)
  expect(payloads[1]?.startsWith('"')).toBe(true)
  })

  it("keeps quoted sentences intact when under max length", () => {
  const lines = [
    "00:00:02:00\t00:00:05:05\tMarker",
    "00:00:05:05\t00:00:07:21\tMarker",
    "00:00:07:21\t00:00:11:26\tMarker",
    "00:00:11:26\t00:00:16:18\tMarker",
    "00:00:16:18\t00:00:20:08\tMarker",
    "00:00:20:08\t00:00:22:24\tMarker",
    "00:00:22:24\t00:00:23:18\tMarker",
    "00:00:23:18\t00:00:28:02\tMarker",
    "00:00:28:02\t00:00:30:29\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    `I made up my mind to start the project. The idea kept growing, and I couldn't stop thinking, "Is this the right time?"`

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: true,
    maxChars: 54,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(
    payloads.some((line) => line.includes(`"Is this the right time?"`))
  ).toBe(true)
  expect(payloads.some((line) => line.trim() === '"')).toBe(false)
  })

  it("always splits after periods when possible", () => {
  const lines = [
    "00:00:26:10\t00:00:31:06\tMarker",
    "00:00:31:06\t00:00:38:13\tMarker",
    "00:00:38:13\t00:00:41:28\tMarker",
    "00:00:41:28\t00:00:44:02\tMarker",
    "00:00:44:02\t00:00:46:11\tMarker",
    "00:00:46:11\t00:00:51:20\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    "Riverton's services were limited, and when accidents strike, people can only look up and ask why. That kind of pain is unbearable, so I couldn't just stand by."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: false,
    maxChars: 140,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("why. That"))).toBe(false)
  expect(payloads.some((line) => line.endsWith("ask why."))).toBe(true)
  expect(payloads.some((line) => line.startsWith("That kind of pain"))).toBe(true)
  })

  it("keeps em dash phrases glued without inserting spaces", () => {
  const lines = [
    "00:00:00:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:04:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    "This main hall we have now---that was our office, and it was also where we lived."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: false,
    maxChars: 36,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("now---that"))).toBe(true)
  expect(payloads.some((line) => line.includes("now--- that"))).toBe(false)
  })

  it("keeps 'to' with the following verb", () => {
  const lines = [
    "00:00:00:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:04:00\tMarker",
    "00:00:04:00\t00:00:06:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph = "We will try to keep moving forward."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: false,
    maxChars: 15,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("to keep"))).toBe(true)
  expect(payloads.some((line) => line.endsWith("to"))).toBe(false)
  })

  it("does not split copular clauses when they fit", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph = "and he truly understood what I was trying to do."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: true,
    maxChars: 54,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("what I was trying to do."))).toBe(
    true
  )
  expect(payloads.some((line) => line.endsWith("what I"))).toBe(false)
  })

  it("keeps dialogue tags with preceding question when it fits", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    '"How can that be possible?" they said. Afterwards, they left.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: false,
    maxChars: 60,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).toContain('"How can that be possible?" they said.')
  expect(payloads.some((line) => line.startsWith("Afterwards,"))).toBe(true)
  })

  it("does not add extra quotes to repeated inline lines", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph = '"How can that be possible?" they said.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: true,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.endsWith('said."'))).toBe(false)
  })

  it("keeps honorific abbreviations with the following word", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Ms. Lin said hello.",
    { maxChars: 4, inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).not.toContain("Ms.")
  expect(payloads.some((line) => line.includes("Ms. Lin"))).toBe(true)
  })

  it("uses default no-split abbreviations when none are provided", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Ms. Lin said hello.",
    { maxChars: 4, inline: true }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).not.toContain("Ms.")
  expect(payloads.some((line) => line.includes("Ms. Lin"))).toBe(true)
  })

  it("keeps UI and CLI fill outputs in parity for default abbreviations", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    "Hi, I'm Dr. Lin, and this project is well known in the U.S."

  const uiLike = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 32,
    inline: true,
  })
  const cliLike = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 32,
    inline: true,
    noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS,
  })

  expect(uiLike).toEqual(cliLike)
  })

  it("keeps U.S. together when split after U.", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "hugely respected in the U.S.",
    { maxChars: 26, inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).not.toContain("U.")
  expect(payloads.some((line) => line.includes("U.S."))).toBe(true)
  })

  it("keeps p.m. together when split after p.", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "We met at 3 p.m. today.",
    { maxChars: 12, inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads).not.toContain("p.")
  expect(payloads.some((line) => line.includes("p.m."))).toBe(true)
  })

  it("keeps time with meridiem together", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "We met at 3 p.m. today.",
    { maxChars: 12, inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("3 p.m."))).toBe(true)
  expect(payloads).not.toContain("3")
  })

  it("avoids splitting numeric comma groups", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "NT$10,000 today.",
    { maxChars: 9, inline: true }
  )
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.includes("10,000"))).toBe(true)
  expect(payloads).not.toContain("10,")
  })

  it("preserves quote continuity when a split lands inside quotes", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const paragraph =
    '"Please open the door and come inside now because it is cold," he said before leaving.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 26,
    inline: true,
  })

  const payloads = result.lines.filter((line) => !line.includes("\t"))
  expect(payloads).toHaveLength(2)
  expect(payloads[0]?.startsWith('"')).toBe(true)
  expect(payloads[0]?.endsWith('"')).toBe(true)
  expect(payloads[1]?.startsWith('"')).toBe(true)
  })

  it("avoids dangling quotes when splitting a quoted paragraph", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const paragraph =
    'A voice said, "Please open the door and come inside now because the room is cold and dark." Then we left for home.'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 36,
    inline: true,
  })

  const payloads = result.lines.filter((line) => !line.includes("\t"))
  expect(payloads.length).toBeGreaterThan(1)
  expect(payloads.some((line) => line.includes('"'))).toBe(true)
  payloads.forEach((line) => {
    const quoteCount = (line.match(/"/g) ?? []).length
    expect(quoteCount % 2).toBe(0)
  })
  })

  it("does not emit standalone quote-only payload lines", () => {
  const lines = [
    "00:00:08:17\t00:00:10:23\tSource 1",
    "00:00:10:23\t00:00:13:00\tSource 2",
    "00:00:13:00\t00:00:14:24\tSource 3",
    "00:00:14:24\t00:00:18:08\tSource 4",
    "00:00:18:08\t00:00:20:23\tSource 5",
    "00:00:20:23\t00:00:22:28\tSource 6",
    "00:00:22:28\t00:00:25:11\tSource 7",
    "00:00:25:11\t00:00:27:20\tSource 8",
    "00:00:27:20\t00:00:29:18\tSource 9",
    "00:00:29:18\t00:00:30:28\tSource 10",
    "00:00:30:28\t00:00:32:07\tSource 11",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    'I reviewed the report, then asked a few follow-up questions about the timeline and details. He said, "Yes. I can stay online, and I will share updates if anything changes."'

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: true,
    noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS,
  })
  const payloads = result.lines.filter((line) => !line.includes("\t"))

  expect(payloads.some((line) => line.trim() === '"')).toBe(false)
  })

  it("does not return quote-only head chunks from splitter", () => {
  const split = __testTakeLine('"', 54, null, false)
  expect(split.line).toBe("")
  expect(split.rest).toBe('"')
  })

  it("moves trailing bare conjunctions to the next split chunk", () => {
  const split = __testTakeLine(
    "mixed signals can make you anxious, irritable, and disrupt your sleep.",
    54,
    null,
    false
  )
  expect(split.line.endsWith(" and")).toBe(false)
  expect(split.rest.startsWith("and ")).toBe(true)
  })

  it("moves trailing 'the' to the next split chunk", () => {
  const split = __testTakeLine(
    "This is a classic case of indigestion affecting the autonomic nervous system.",
    54,
    null,
    false
  )
  expect(split.line.endsWith(" the")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("the ")).toBe(true)
  })

  it("moves trailing 'before' to the next split chunk", () => {
  const split = __testTakeLine(
    "acid reflux, heart palpitations, or insomnia before they do anything about it.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" before")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("before ")).toBe(true)
  })

  it("moves trailing 'after' to the next split chunk", () => {
  const split = __testTakeLine(
    "we should review the checklist after we finish the call.",
    38,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" after")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("after ")).toBe(true)
  })

  it("moves trailing 'while' to the next split chunk", () => {
  const split = __testTakeLine(
    "please keep the notes open while we compare both versions.",
    34,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" while")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("while ")).toBe(true)
  })

  it("moves trailing 'like' to the next split chunk", () => {
  const split = __testTakeLine(
    "It also raises your risk of chronic diseases like high blood pressure and diabetes.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" like")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("like ")).toBe(true)
  })

  it("moves trailing 'of' to the next split chunk", () => {
  const split = __testTakeLine(
    "This method increases the risk of sudden outages during migration.",
    34,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" of")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("of ")).toBe(true)
  })

  it("keeps 'to the' together when trailing-article normalization runs", () => {
  const split = __testTakeLine(
    "The update happened to the release schedule during testing.",
    24,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" to")).toBe(false)
  expect(split.line).toBe("The update happened")
  expect(split.rest.toLowerCase().startsWith("to the ")).toBe(true)
  })
})
