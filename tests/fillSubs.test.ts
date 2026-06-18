import { describe, it, expect } from "vitest"
import {
  __testMergeJoinableTranslations,
  __testTakeLine,
  fillSelectedTimestampLines,
} from "../src/shared/fillSubs"
import { canJoinAdjacentText } from "../src/shared/joinableText"

const NO_SPLIT_ABBREVIATIONS = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "U.S.",
  "a.m.",
  "p.m.",
]

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
    "00:00:11:00\t00:00:12:00\tNo blank",
    "One two",
    "00:00:12:00\t00:00:13:00\tNo blank",
    "three four",
    "",
  ])
  })

  it("overwrites timestamps that already have subtitle text below by default", () => {
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
    "00:00:01:00\t00:00:03:00\tMarker",
    "Hello world",
    "00:00:03:00\t00:00:05:00\tMarker",
    "Hello world",
  ])
  expect(result.remaining).toBe("")
  })

  it("overwrites all contiguous subtitle lines under a timestamp", () => {
  const lines = [
    "00:00:01:00\t00:00:03:00\tMarker",
    "Old first line",
    "Old second line",
    "00:00:03:00\t00:00:05:00\tMarker",
  ]
  const selected = new Set([0, 3])

  const result = fillSelectedTimestampLines(lines, selected, "Hello world", {
    inline: false,
  })

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:03:00\tMarker",
    "Hello world",
    "00:00:03:00\t00:00:05:00\tMarker",
    "Hello world",
  ])
  expect(result.remaining).toBe("")
  })

  it("skips timestamps with existing subtitle text when preserveExisting is enabled", () => {
  const lines = [
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "Hello world", {
    inline: false,
    preserveExisting: true,
  })

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:03:00\tMarker",
    "Already translated line",
    "00:00:03:00\t00:00:05:00\tMarker",
    "Hello world",
  ])
  expect(result.remaining).toBe("")
  })

  it("ignores blank lines when deciding whether to fill inside cross-block mode", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "One two three", {
    maxChars: 10,
    inline: false,
    crossBlockFill: true,
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

  it("stops filling at empty-line block boundaries by default", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "One two",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
  ])
  expect(result.remaining).toBe("three")
  })

  it("can continue filling across empty-line boundaries when crossBlockFill is enabled", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 2])

  const result = fillSelectedTimestampLines(lines, selected, "One two three", {
    maxChars: 10,
    inline: false,
    crossBlockFill: true,
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
    "00:00:01:00\t00:00:02:00\tMarker",
    'He said, "hello."',
    "00:00:02:00\t00:00:03:00\tMarker",
    "Then left.",
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

  it("does not move leading of onto the previous filled line by default", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The power of now",
    { maxChars: 12, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "The power",
    "00:00:02:00\t00:00:03:00\tMarker",
    "of now",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not move leading of onto the previous filled line when altBreak is enabled", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The power of now",
    { maxChars: 12, inline: false, altBreak: true }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "The power",
    "00:00:02:00\t00:00:03:00\tMarker",
    "of now",
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

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !/^\d{2}:\d{2}:\d{2}:\d{2}\t/.test(line)
  )
  let maxRun = 0
  let run = 0
  let last = ""
  for (const translation of translations) {
    if (translation === last) {
      run += 1
    } else {
      run = 1
      last = translation
    }
    if (run > maxRun) maxRun = run
  }
  expect(maxRun).toBeLessThanOrEqual(3)
  })

  it("chooses a target CPS that reaches the end of long quoted paragraphs", () => {
  const lines = [
    "00:00:00:00\t00:00:01:15\tMarker",
    "00:00:01:15\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:15\tMarker",
    "00:00:04:15\t00:00:06:00\tMarker",
    "00:00:06:00\t00:00:09:00\tMarker",
    "00:00:09:00\t00:00:12:00\tMarker",
    "00:00:12:00\t00:00:14:00\tMarker",
    "00:00:14:00\t00:00:15:00\tMarker",
    "00:00:15:00\t00:00:17:00\tMarker",
    "00:00:17:00\t00:00:20:00\tMarker",
    "00:00:20:00\t00:00:22:00\tMarker",
  ]
  const selected = new Set(lines.map((_, index) => index))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    `If you don't know what to do, say so. "I don't know what's best, but maybe we can find someone to help us figure it out." And keep showing you care. "If you want to talk, call me. You're not bothering me. What can I do to help you feel a little better?"`,
    { maxChars: 54, inline: true }
  )

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !/^\d{2}:\d{2}:\d{2}:\d{2}\t/.test(line)
  )

  expect(result.remaining).toBe("")
  expect(translations.at(-1)).toContain("little better?")
  expect(translations.at(-1)?.startsWith('"')).toBe(true)
  expect(translations.filter((line) => line === `"I don't know what's best,"`).length).toBeLessThan(
    translations.length / 2
  )
  })

  it("does not let post-merge rewrite cps span allocation", () => {
  const lines = [
    "00:07:52:21\t00:07:54:14\t第一大類就是說",
    "00:07:54:14\t00:07:56:06\t我在職場上碰到內向者",
    "00:07:56:06\t00:07:56:27\t尤其是我需要",
    "00:07:56:27\t00:07:58:02\t管理內向者的時候",
    "00:07:58:02\t00:07:59:18\t我不知道他們在想什麼",
    "00:07:59:18\t00:08:01:04\t怎麼辦",
  ]
  const selected = new Set([0, 1, 2, 3, 4, 5])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The first is people saying: I work with introverts and have no idea what they're thinking.",
    { maxChars: 54, inline: true }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations).not.toContain("I work with introverts")
  expect(translations).not.toContain("and have no idea what they're thinking.")
  expect(translations[0]).toBe("The first is people saying:")
  expect(translations[1]).toBe("I work with introverts and have no idea what")
  expect(translations[4]).toBe("they're thinking.")
  expect(translations[5]).toBe("they're thinking.")
  expect(result.remaining).toBe("")
  })

  it("avoids early comma split before quoted clause when later fit exists", () => {
  const lines = [
    "00:07:52:21\t00:07:54:14\t第一大類就是說",
    "00:07:54:14\t00:07:56:06\t我在職場上碰到內向者",
    "00:07:56:06\t00:07:56:27\t尤其是我需要",
    "00:07:56:27\t00:07:58:02\t管理內向者的時候",
    "00:07:58:02\t00:07:59:18\t我不知道他們在想什麼",
    "00:07:59:18\t00:08:01:04\t怎麼辦",
  ]
  const selected = new Set([0, 1, 2, 3, 4, 5])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The first is people saying, \"I work with introverts and have no idea what they're thinking.\"",
    { maxChars: 54, inline: true }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations[0]).toBe("The first is people saying,")
  expect(translations[1]).toBe("The first is people saying,")
  expect(translations[2]).toBe('"I work with introverts and have no idea what"')
  expect(result.remaining).toBe("")
  })

  it("does not split a one-word head before who-clauses", () => {
  const lines = [
    "00:09:41:00\t00:09:43:11\t再來會有家長來找我",
    "00:09:43:11\t00:09:46:24\t這種家長通常分成兩種",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Parents who come to see me usually fall into two groups.",
    { maxChars: 54, inline: true }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations).not.toContain("Parents")
  expect(translations[0]?.startsWith("Parents who")).toBe(true)
  expect(result.remaining).toBe("")
  })

  it("prefers later dash boundary over early comma when both fit", () => {
  const lines = [
    "00:14:14:04\t00:14:16:28\t記得做我們能做的事情",
    "00:14:16:28\t00:14:17:29\t用我們最大的努力",
    "00:14:17:29\t00:14:19:21\t去展現自己的價值",
    "00:14:19:21\t00:14:20:27\t因為沒有其他人",
    "00:14:20:27\t00:14:23:07\t可以幫你展現這一點",
  ]
  const selected = new Set([0, 1, 2, 3, 4])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Do what you can, do your best to show your value--- because no one else can do it for you.",
    { maxChars: 54, inline: true }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations[0]).toBe("Do what you can, do your best to show your value---")
  expect(translations).not.toContain("Do what you can,")
  expect(result.remaining).toBe("")
  })

  it("keeps triple hyphen atomic at split boundaries", () => {
  const split = __testTakeLine(
    "Do what you can, and do your best to show your value--- because no one else can show it for you.",
    54,
    null,
    true
  )

  expect(split.line.endsWith("--") && split.rest.startsWith("-")).toBe(false)
  })

  it("avoids splitting list items at commas and keeps trailing 'that'", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Let him know that feeling frustrated, sad,",
    "00:00:02:00\t00:00:03:00\tMarker",
    "or worn out is normal.",
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

  it("splits before clause-style 'or how to' after a comma", () => {
  const split = __testTakeLine(
    "behind, like their assets and belongings, or how to sort things out without causing regret.",
    54,
    null,
    false
  )

  expect(split.line).toBe("behind, like their assets and belongings,")
  expect(split.rest).toBe("or how to sort things out without causing regret.")
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Next, we review the",
    "00:00:02:00\t00:00:03:00\tMarker",
    "plan carefully",
  ])
  expect(result.remaining).toBe("before taking action.")
  })

  it("does not split early at comma when a later conjunction break still fits", () => {
  const split = __testTakeLine(
    "I hope that when I die, they'll take my body and place it in cold storage at the funeral home.",
    54,
    null,
    false
  )

  expect(split.line).toBe("I hope that when I die,")
  expect(split.rest).toBe("they'll take my body and place it in cold storage at the funeral home.")
  })

  it("keeps comma split precedence over later so split", () => {
  const split = __testTakeLine(
    "I may be making less money now, but I'm so much happier.",
    40,
    null,
    false
  )

  expect(split.line).toBe("I may be making less money now,")
  expect(split.rest).toBe("but I'm so much happier.")
  })

  it("does not fallback-split at leading conjunction index zero", () => {
  const split = __testTakeLine(
    "but I do think wealth depends a lot on your background, abilities, and luck.",
    40,
    null,
    false
  )

  expect(split.line).toBe("but I do think wealth depends a lot on")
  expect(split.rest).toBe("your background, abilities, and luck.")
  })

  it("keeps comma split precedence on subordinate lead-ins", () => {
  const split = __testTakeLine(
    "Because if we don't, it'll be hard to transition from the second stage of life into the third.",
    54,
    null,
    false
  )

  expect(split.line).toBe("Because if we don't,")
  expect(split.rest).toBe("it'll be hard to transition from the second stage of life into the third.")
  })

  it("merges joinable adjacent fill outputs when joined text fits max chars", () => {
  const lines = [
    "00:10:29:07\t00:10:31:18\tA",
    "00:10:31:18\t00:10:33:27\tB",
    "00:10:33:27\t00:10:36:25\tC",
    "00:10:36:25\t00:10:39:17\tD",
    "00:10:39:17\t00:10:42:08\tE",
  ]
  const selected = new Set([0, 1, 2, 3, 4])
  const paragraph =
    "We need to prepare for this. Because if we don't, it'll be hard to transition from the second stage of life into the third."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: true,
  })

  expect(result.lines).toEqual([
    "00:10:29:07\t00:10:31:18\tA",
    "We need to prepare for this.",
    "00:10:31:18\t00:10:33:27\tB",
    "We need to prepare for this.",
    "00:10:33:27\t00:10:36:25\tC",
    "Because if we don't,",
    "00:10:36:25\t00:10:39:17\tD",
    "it'll be hard to transition from the second stage of",
    "00:10:39:17\t00:10:42:08\tE",
    "life into the third.",
  ])
  })

  it("merges sentence-end joins that would otherwise trigger joinable-break", () => {
  const lines = [
    "00:19:00:26\t00:19:02:09\tA",
    "00:19:02:09\t00:19:03:24\tB",
    "00:19:03:24\t00:19:05:16\tC",
    "00:19:05:16\t00:19:06:21\tD",
    "00:19:06:21\t00:19:08:25\tE",
  ]
  const selected = new Set([0, 1, 2, 3, 4])
  const paragraph =
    "What do they ask about? What do they complain about? What matters to them? Even their personal lives."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: false,
  })

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations).not.toContain("What matters to them?")
  expect(translations).not.toContain("Even their personal lives.")
  expect(translations).toContain("What matters to them? Even their personal lives.")
  })

  it("re-joins cps-driven sentence splits when joined text still fits max chars", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tA",
    "00:00:02:00\t00:00:03:00\tB",
  ]
  const selected = new Set([0, 1])
  const paragraph = "What matters to them? Even their personal lives."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: false,
  })

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tA",
    "What matters to them? Even their personal lives.",
    "00:00:02:00\t00:00:03:00\tB",
    "What matters to them? Even their personal lives.",
  ])
  })

  it("merge pass joins sentence-end adjacent lines when they fit max chars", () => {
  const merged = __testMergeJoinableTranslations(
    ["What matters to them?", "Even their personal lives."],
    54
  )

  expect(merged).toEqual([
    "What matters to them? Even their personal lives.",
    "What matters to them? Even their personal lives.",
  ])
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "And one last thing you can do is",
    "00:00:02:00\t00:00:03:00\tMarker",
    "give your partner the right kind of support.",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before copular when the tail starts with an infinitive", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "But the goal is to get through it without burning bridges---",
    { maxChars: 25, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "But the goal",
    "00:00:02:00\t00:00:03:00\tMarker",
    "is to get through it",
  ])
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Even so,",
    "00:00:02:00\t00:00:03:00\tMarker",
    "it can",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Even though",
    "00:00:02:00\t00:00:03:00\tMarker",
    "that was true,",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "We focused on",
    "00:00:02:00\t00:00:03:00\tMarker",
    "how to do it.",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not split before clause starters when the left side is too short", () => {
  const split = __testTakeLine(
    "That's when I finally understood how the system worked.",
    54,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.line).not.toBe("That's")
  expect(split.rest.startsWith("when ")).toBe(false)
  })

  it("does not split before because as a clause-starter heuristic", () => {
  const split = __testTakeLine(
    "A patient came to see me because he had a lot of gas.",
    45,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.rest.startsWith("because ")).toBe(false)
  })

  it("allows natural fallback splits after to", () => {
  const split = __testTakeLine(
    "I often use heat-clearing and detoxifying formulas to treat foul-smelling gas.",
    54,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.line).toBe("I often use heat-clearing and detoxifying formulas to")
  expect(split.rest).toBe("treat foul-smelling gas.")
  })

  it("does not split after short copular heads", () => {
  const split = __testTakeLine(
    "This is what I've learned from years of practice.",
    80,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.line).not.toBe("This is")
  expect(split.rest.startsWith("what ")).toBe(false)
  })

  it("does not start the next chunk with a comma", () => {
  const lines = [
    "00:00:01:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:05:00\tMarker",
    "00:00:05:00\t00:00:07:00\tMarker",
    "00:00:07:00\t00:00:09:00\tMarker",
  ]
  const selected = new Set([0, 1, 2, 3])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "and now in local groups across the U.S., I've seen the same pattern before.",
    {
      maxChars: 54,
      inline: true,
      noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS,
    }
  )

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  expect(translations.some((line) => line.trimStart().startsWith(","))).toBe(false)
  expect(translations.some((line) => line.endsWith("U.S.,"))).toBe(true)
  })

  it("does not leave pronoun contractions stranded at line end", () => {
  const split = __testTakeLine(
    "It was the strangest result he'd ever seen.",
    42,
    null,
    false
  )

  expect(split.line.endsWith("he'd")).toBe(false)
  expect(split.line.includes("he'd ever")).toBe(true)
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "He laughed like that",
    "00:00:02:00\t00:00:03:00\tMarker",
    "every time.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Hi, I'm Dr. Chuang Chia-ying,",
    "00:00:02:00\t00:00:03:00\tMarker",
    "a Chinese medicine doctor.",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps trailing 'that' after reporting verbs when it fits", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "He told me that it",
    "00:00:02:00\t00:00:03:00\tMarker",
    "was over.",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before 'that' after a comma", () => {
  const split = __testTakeLine(
    "He reminded her how much she mattered, that being together meant everything.",
    44,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.line).toBe("He reminded her how much she mattered,")
  expect(split.rest).toBe("that being together meant everything.")
  })

  it("does not keep trailing that's clauses on comma splits when it fits", () => {
  const split = __testTakeLine(
    "For people who really love each other, that's real growth and a really important way to support each other.",
    54,
    null,
    false
  )

  expect(split.line).toBe("For people who really love each other,")
  expect(split.rest).toBe("that's real growth and a really important way to support each other.")
  })

  it("keeps dash splits before leading that's clauses", () => {
  const split = __testTakeLine(
    "to be close and really get to know each other---that's already something rare in love.",
    54,
    null,
    false
  )

  expect(split.line).toBe("to be close and really get to know each other---")
  expect(split.rest).toBe("that's already something rare in love.")
  })

  it("does not keep 'that' at end of previous line for relative clauses", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "He told me a story",
    "00:00:02:00\t00:00:03:00\tMarker",
    "that moved me.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "and that",
    "00:00:02:00\t00:00:03:00\tMarker",
    "was enough.",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not keep trailing 'that' before pronoun-led clauses", () => {
  const split = __testTakeLine(
    "The biggest benefit is that it opens up my perspective.",
    22,
    null,
    false
  )

  expect(split.line).toBe("The biggest benefit is")
  expect(split.rest).toBe("that it opens up my perspective.")
  })

  it("does not keep trailing 'that' after reporting verbs with audience noun objects", () => {
  const split = __testTakeLine(
    "He likes to tell people that my hands and feet are always cold.",
    24,
    null,
    false
  )

  expect(split.line).toBe("He likes to tell people")
  expect(split.rest).toBe("that my hands and feet are always cold.")
  })

  it("does not keep trailing 'that' before indefinite-subject clauses when it fits", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The truth is that something changed.",
    { maxChars: 25, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "The truth is",
    "00:00:02:00\t00:00:03:00\tMarker",
    "that something changed.",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not keep trailing 'that' before bare indefinite-subject clauses when it fits", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The truth is that nobody noticed.",
    { maxChars: 25, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "The truth is",
    "00:00:02:00\t00:00:03:00\tMarker",
    "that nobody noticed.",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not keep trailing 'that' before bare noun-subject clauses", () => {
  const split = __testTakeLine(
    "Everyone kept telling me that dementia was a long goodbye.",
    25,
    null,
    false
  )

  expect(split.line).toBe("Everyone kept telling me")
  expect(split.rest).toBe("that dementia was a long goodbye.")
  })

  it("does not exceed maxChars for forced trailing that", () => {
  const lines = [
    "00:02:13:20\t00:02:14:23\t參與工程的話",
    "00:02:14:23\t00:02:18:01\t就是說我到現在就覺得說",
    "00:02:18:01\t00:02:19:09\t你在叢林工作",
    "00:02:19:09\t00:02:21:18\t就是說時間做哪一個工作",
    "00:02:21:18\t00:02:23:25\t都是你的功課",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Working on the construction project made me realize that in monastic life, every kind of work is part of the practice.",
    { inline: true, maxChars: 54, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const translations = result.lines.filter((line) => !line.includes("\t"))
  const maxLength = Math.max(...translations.map((line) => line.length))

  expect(maxLength).toBeLessThanOrEqual(54)
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "A Chinese American science fiction writer",
    "00:00:02:00\t00:00:03:00\tMarker",
    "who's hugely respected in the U.S.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "Even so, becoming a caregiver hasn't been easy,",
    "00:00:02:00\t00:00:03:00\tMarker",
    "and I've had a lot of setbacks.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "breather.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "My wife does this all the time.",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps short full sentences together when they fit", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "It is true. My wife does this all the time.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "It is true. My wife does this all the time.",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps two short full sentences together when they fit", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Don't rush. First loosen the soil.",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "Don't rush. First loosen the soil.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "Don't rush. First loosen the soil.",
  ])
  expect(result.remaining).toBe("")
  })

  it("keeps a period-separated short paragraph whole in inline fill when it fits", () => {
  const lines = [
    "00:01:03:11\t00:01:04:15\t好 來 夾起來",
    "00:01:04:15\t00:01:06:29\t一二三",
    "00:01:06:29\t00:01:08:03\t好 再放",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph = "Squeeze. One, two, three. And release."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: true,
  })
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).toEqual([paragraph, paragraph, paragraph])
  expect(result.remaining).toBe("")
  })

  it("does not keep fragment-plus-sentence lines whole in inline fill", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])
  const paragraph = "the neighbors. He'd brought her lots of gifts."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: true,
  })
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).toEqual([
    "the neighbors.",
    "He'd brought her lots of gifts.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "breather.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "My wife does this all the time.",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits lowercase sentence tails before a new full sentence", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "back. What should we do?",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "back.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "What should we do?",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits quoted fragment-plus-sentence lines instead of keeping them whole", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])
  const paragraph = "\"but isn't great with people. What should we do?\""

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: false,
  })

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations.some((line) => line.includes("people. What should"))).toBe(false)
  })

  it("does not keep a sentence tail with the next full sentence after a prior split", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
  ]
  const selected = new Set([0, 1, 2])
  const paragraph =
    "but isn't great with people and sometimes pushes back. What should we do?"

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 45,
    inline: false,
  })

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations.some((line) => line.includes("back. What should we do?"))).toBe(false)
  expect(translations.some((line) => /back\.\s+What\b/.test(line))).toBe(false)
  })

  it("splits full sentence before a trailing fragment even under maxChars", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "She nodded. still unsure what to do next.",
    { maxChars: 60, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "She nodded.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "still unsure what to do next.",
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

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  for (const translation of translations) {
    expect(translation.length).toBeLessThanOrEqual(maxChars)
  }
  })

  it("keeps carried-quote inline output within maxChars", () => {
  const lines = [
    "00:13:57:11\t00:13:58:21\t她說",
    "00:13:58:21\t00:13:59:28\t她打電話給哥哥",
    "00:13:59:28\t00:14:01:18\t在美國的哥哥說",
    "00:14:01:18\t00:14:03:23\t你下個月回來吧",
    "00:14:03:23\t00:14:06:07\t我把房子過戶給你",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const maxChars = 54
  const paragraph =
    `She said she called him, and he told her, "Next month, I’ll take care of the transfer."`

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars,
    inline: true,
  })

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  for (const translation of translations) {
    expect(translation.length).toBeLessThanOrEqual(maxChars)
    }
  })

  it("does not let dash continuation merge exceed maxChars", () => {
    const lines = [
      "00:06:18:21\t00:06:20:21\t所以他就想了三個",
      "00:06:20:21\t00:06:22:00\t自己的關鍵詞",
      "00:06:22:00\t00:06:24:07\t就是讓數字說故事",
      "00:06:24:07\t00:06:26:21\t解決問題以及細膩",
    ]
    const selected = new Set([0, 1, 2, 3])
    const maxChars = 54
    const paragraph =
      "So he came up with three keywords for himself---making numbers tell stories, solving problems, and sweating the details."

    const result = fillSelectedTimestampLines(lines, selected, paragraph, {
      maxChars,
      inline: true,
    })

    const translations = result.lines.filter((line) => !line.includes("\t"))
    for (const translation of translations) {
      expect(translation.length).toBeLessThanOrEqual(maxChars)
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "and that chance was gone.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "He later moved away.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "The issue now is how to solve this quickly",
    "00:00:02:00\t00:00:03:00\tMarker",
    "The issue now is how to solve this quickly",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "The best exercise for older adults is simply walking",
    "00:00:02:00\t00:00:03:00\tMarker",
    "The best exercise for older adults is simply walking",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "The truth is we need to leave",
    "00:00:02:00\t00:00:03:00\tMarker",
    "The truth is we need to leave",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not use to-verb phrase splitting before object", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "We don't believe they have to follow the exact",
    "00:00:02:00\t00:00:03:00\tMarker",
    "same path we did.",
  ])
  expect(result.remaining).toBe("")
  })

  it("does not force splitting before infinitive clauses after noun phrases", () => {
  const split = __testTakeLine(
    "We don't always get the chance to say what matters most.",
    44,
    null,
    false,
    { allowHeuristicSplitsWhenFits: true }
  )

  expect(split.line.endsWith(" chance")).toBe(false)
  expect(split.rest.startsWith("to say")).toBe(false)
  })

  it("does not keep trailing 'with' on previous line when it fits", () => {
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "They arrived at the station with",
    "00:00:02:00\t00:00:03:00\tMarker",
    "extra supplies.",
  ])
  expect(result.remaining).toBe("")
  })

  it("splits before 'near' as a low-priority fallback", () => {
  const lines = [
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set([0, 1])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "He suddenly heard knocking outside near where the truck was parked.",
    { maxChars: 54, inline: false }
  )

  expect(result.lines).toEqual([
    "00:00:01:00\t00:00:02:00\tMarker",
    "He suddenly heard knocking outside",
    "00:00:02:00\t00:00:03:00\tMarker",
    "near where the truck was parked.",
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
    "00:00:01:00\t00:00:02:00\tMarker",
    "I've been working at the lab since it was founded.",
    "00:00:02:00\t00:00:03:00\tMarker",
    "I've been working at the lab since it was founded.",
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).toContain('A voice inside said, "Just push it."')
  expect(translations).not.toContain('"A voice inside said, "Just push it."')
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(
    translations.some((line) => line.includes(`"Is this the right time?"`))
  ).toBe(true)
  expect(translations.some((line) => line.trim() === '"')).toBe(false)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("why. That"))).toBe(false)
  expect(translations.some((line) => line.endsWith("ask why."))).toBe(true)
  expect(translations.some((line) => line.startsWith("That kind of pain"))).toBe(true)
  })

  it("keeps em dash boundary before leading that clauses", () => {
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.endsWith("now---"))).toBe(true)
  expect(translations.some((line) => line.startsWith("that was"))).toBe(true)
  expect(translations.some((line) => line.includes("now--- that"))).toBe(false)
  })

  it("keeps dash + lowercase continuation together", () => {
  const split = __testTakeLine(
    "Try this---every day when you eat, pause and feel grateful for what made your meal possible.",
    54,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(split.line).toBe("Try this---every day when you eat,")
  expect(split.rest).toBe("pause and feel grateful for what made your meal possible.")
  })

  it("prefers dash split over last-resort space split", () => {
  const split = __testTakeLine(
    "A natural death is part of God's plan---it's life coming full circle.",
    49,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(split.line).toBe("A natural death is part of God's plan---")
  expect(split.rest).toBe("it's life coming full circle.")
  })

  it("uses modal split before plain space as second-last recourse", () => {
  const split = __testTakeLine(
    "That's how both the living and the dead can be at peace, without regret.",
    54,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(split.line).toBe("That's how both the living and the dead")
  expect(split.rest).toBe("can be at peace, without regret.")
  })

  it("prefers later dash split over early comma-or split", () => {
  const split = __testTakeLine(
    "Not our parents, or the generations before them--- because none of them ever lived this long.",
    54,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(split.line).toBe("Not our parents, or the generations before them---")
  expect(split.rest).toBe("because none of them ever lived this long.")
  })

  it("keeps hyphenated compounds glued without inserting spaces", () => {
  const lines = [
    "00:00:00:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:04:00\tMarker",
    "00:00:04:00\t00:00:06:00\tMarker",
    "00:00:06:00\t00:00:08:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    "This is a foundation in the grief-and-loss workshops we lead."

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    inline: false,
    maxChars: 42,
  })
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("grief-and-loss"))).toBe(true)
  expect(translations.some((line) => /grief-\s*$/.test(line))).toBe(false)
  expect(translations.some((line) => /^and-loss\b/.test(line))).toBe(false)
  })

  it("allows natural fallback splits after trailing to", () => {
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).toContain("We will try to")
  expect(translations.some((line) => line.includes("to keep"))).toBe(false)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("what I was trying to do."))).toBe(
    true
  )
  expect(translations.some((line) => line.endsWith("what I"))).toBe(false)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).toContain('"How can that be possible?" they said.')
  expect(translations.some((line) => line.startsWith("Afterwards,"))).toBe(true)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.endsWith('said."'))).toBe(false)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("Ms.")
  expect(translations.some((line) => line.includes("Ms. Lin"))).toBe(true)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("Ms.")
  expect(translations.some((line) => line.includes("Ms. Lin"))).toBe(true)
  })

  it("keeps Supt. with the following name by default", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Vice Supt. Tu Shih-mien arrived.",
    { maxChars: 11, inline: true }
  )
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("Vice Supt.")
  expect(translations.some((line) => line.includes("Supt. Tu"))).toBe(true)
  })

  it("keeps dotted initials with the following surname by default", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
    "00:00:03:00\t00:00:04:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Don't bother inviting Ted Hsu and T.H. Tung.",
    { maxChars: 30, inline: true }
  )
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("T.H. Tung."))).toBe(true)
  expect(translations.some((line) => line === "T.H.")).toBe(false)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("U.")
  expect(translations.some((line) => line.includes("U.S."))).toBe(true)
  })

  it("keeps U.S. Supreme Court together as a phrase", () => {
  const result = __testTakeLine(
    "the first woman on the U.S. Supreme Court.",
    29,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(result.line).not.toMatch(/U\.S\.$/)
  expect(result.rest).toContain("U.S. Supreme Court.")
  })

  it("keeps 'according to' with its full phrase", () => {
  const result = __testTakeLine(
    "According to U.S. statistics, NDDs are common.",
    34,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(result.line).toBe("According to U.S. statistics,")
  expect(result.rest).toBe("NDDs are common.")
  })

  it("keeps the full line when the limit lands exactly at a word boundary", () => {
  const result = __testTakeLine(
    "The rest is divided among the heirs according to their inheritance shares.",
    48,
    null,
    false
  )

  expect(result.line).toBe("The rest is divided among the heirs according to")
  expect(result.rest).toBe("their inheritance shares.")
  })

  it("does not split after middle initials before surnames", () => {
  const result = __testTakeLine(
    "According to Richard N. Wolman, spirituality is a human capacity.",
    31,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )

  expect(result.line.endsWith("N.")).toBe(false)
  expect(result.line).toContain("Wolman,")
  })

  it("does not split decimal percentages across cues", () => {
  const lines = [
    "00:05:28:24\t00:05:30:21\t像自閉症好了",
    "00:05:30:21\t00:05:32:19\t在二三十年前認為",
    "00:05:32:19\t00:05:33:19\t大概一萬個",
    "00:05:33:19\t00:05:35:04\t只有四五個孩子",
    "00:05:35:04\t00:05:38:06\t0.4% 0.5%這樣子",
    "00:05:38:06\t00:05:39:04\t現在已經認為",
    "00:05:39:04\t00:05:40:10\t大概有三十三分之一",
    "00:05:40:10\t00:05:42:06\t有占百分之三的孩子",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Twenty or thirty years ago, people thought about 40 or 50 kids out of 10,000 had autism, around 0.4 or 0.5 percent. Now it's estimated at about one in 33 children, roughly 3 percent.",
    { inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("autism, around 0.")
  expect(translations).not.toContain("4 or 0.")
  expect(translations.some((line) => line.includes("0.4 or 0.5 percent."))).toBe(true)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations).not.toContain("p.")
  expect(translations.some((line) => line.includes("p.m."))).toBe(true)
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("3 p.m."))).toBe(true)
  expect(translations).not.toContain("3")
  })

  it("does not split clock time after colon", () => {
  const lines = [
    "00:00:00:00\t00:00:01:00\tMarker",
    "00:00:01:00\t00:00:02:00\tMarker",
    "00:00:02:00\t00:00:03:00\tMarker",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "Now we get up at 3:30 a.m. for morning class.",
    { maxChars: 20, inline: true, noSplitAbbreviations: NO_SPLIT_ABBREVIATIONS }
  )
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => /3:$/.test(line))).toBe(false)
  expect(translations.some((line) => /^30 a\.m\./.test(line))).toBe(false)
  expect(translations.join(" ")).toContain("3:30 a.m.")
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.includes("10,000"))).toBe(true)
  expect(translations).not.toContain("10,")
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

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations).toHaveLength(2)
  expect(translations[0]?.startsWith('"')).toBe(true)
  expect(translations[0]?.endsWith('"')).toBe(true)
  expect(translations[1]?.startsWith('"')).toBe(true)
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

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations.length).toBeGreaterThan(1)
  expect(translations.some((line) => line.includes('"'))).toBe(true)
  translations.forEach((line) => {
    const quoteCount = (line.match(/"/g) ?? []).length
    expect(quoteCount % 2).toBe(0)
  })
  })

  it("does not emit standalone quote-only translation lines", () => {
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
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(translations.some((line) => line.trim() === '"')).toBe(false)
  })

  it("attaches trailing orphan closing quote to the last emitted line", () => {
  const lines = [
    "00:14:35:13\t00:14:36:26\tSource 1",
    "00:14:36:26\t00:14:38:24\tSource 2",
    "00:14:38:24\t00:14:40:06\tSource 3",
    "00:14:40:06\t00:14:41:15\tSource 4",
    "00:14:41:15\t00:14:43:18\tSource 5",
    "00:14:43:18\t00:14:44:17\tSource 6",
    "00:14:44:17\t00:14:46:15\tSource 7",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    `A lot of times when parents buy something new and see their kids messing with it, they go, "Don't touch that, it's dangerous," or "If you break it, it's expensive."`

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars: 54,
    inline: true,
  })
  const translations = result.lines.filter((line) => !line.includes("\t"))

  expect(result.remaining).toBe("")
  expect(translations[translations.length - 1]?.endsWith('."')).toBe(true)
  })

  it("does not return quote-only head chunks from splitter", () => {
  const split = __testTakeLine('"', 54, null, false)
  expect(split.line).toBe("")
  expect(split.rest).toBe('"')
  })

  it("does not split inside quoted ellipses before trailing narration", () => {
  const split = __testTakeLine(
    `"Please do not put me through that..." But they cut him off.`,
    54,
    null,
    false
  )

  expect(split.line).toContain('that..."')
  expect(split.line).not.toBe('"."')
  expect(split.rest.startsWith("But they cut him off.")).toBe(true)
  })

  it("keeps consuming long text that starts with an opening quote", () => {
  const split = __testTakeLine(
    `"but maybe we can find someone to help us figure it out." And keep showing you care.`,
    54,
    null,
    false
  )

  expect(split.line).not.toBe("")
  expect(split.line.startsWith('"')).toBe(true)
  expect(split.rest.length).toBeLessThan(
    `"but maybe we can find someone to help us figure it out." And keep showing you care.`.length
  )
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

  it("moves trailing 'a' to the next split chunk", () => {
  const split = __testTakeLine(
    "whether you can inspire people and make the world a little better just by being here.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" a")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("a little ")).toBe(true)
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

  it("avoids orphaning a single-word 'after' line before conjunction tails", () => {
  const first = __testTakeLine(
    "She got up soon after and screamed at me again at the top of her lungs.",
    54,
    null,
    false
  )

  const second = __testTakeLine(first.rest, 54, null, false)

  expect(second.line.toLowerCase()).not.toBe("after")
  expect(second.line.toLowerCase()).toBe("the top of her lungs.")
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

  it("does not protect trailing just before infinitive", () => {
  const split = __testTakeLine(
    "And don't become someone you're not just to build a persona.",
    40,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" just")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("to ")).toBe(true)
  })

  it("moves trailing copular before where-clause to the next split chunk", () => {
  const split = __testTakeLine(
    "Sharing your own ideas and perspective is where personal branding begins.",
    40,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" is")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("is where ")).toBe(true)
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

  it("does not move trailing 'of' to the next split chunk", () => {
  const split = __testTakeLine(
    "This method increases the risk of sudden outages during migration.",
    34,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" of")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("of ")).toBe(false)
  })

  it("moves trailing 'near' to the next split chunk", () => {
  const split = __testTakeLine(
    "They waited near the entrance until dawn.",
    16,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" near")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("near ")).toBe(true)
  })

  it("moves trailing 'in' to the next split chunk", () => {
  const split = __testTakeLine(
    "The team checked in that report before submission.",
    20,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" in")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("in ")).toBe(true)
  })

  it("moves trailing 'in' before bare noun phrases", () => {
  const split = __testTakeLine(
    "These are probably the three biggest risks in personal branding.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" in")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("in personal ")).toBe(true)
  })

  it("avoids preposition split when a near modal break is better", () => {
  const split = __testTakeLine(
    "how you respond in those first few minutes can determine whether people trust you again.",
    54,
    null,
    false
  )
  expect(split.line).toBe("how you respond in those first few minutes")
  expect(split.rest).toBe("can determine whether people trust you again.")
  })

  it("does not move trailing 'into' to the next split chunk", () => {
  const split = __testTakeLine(
    "and I help clients turn numbers into meaningful stories.",
    38,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" into")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("into ")).toBe(false)
  })

  it("does not move trailing 'on' to the next split chunk", () => {
  const split = __testTakeLine(
    "Please focus on that chart before the meeting starts.",
    21,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" on")).toBe(false)
  expect(split.line).toBe("Please focus on that")
  expect(split.rest.toLowerCase().startsWith("chart ")).toBe(true)
  })

  it("does not move trailing 'at' to the next split chunk", () => {
  const split = __testTakeLine(
    "They arrived at that station just before sunrise.",
    18,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" at")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("at ")).toBe(false)
  })

  it("prefers splitting before 'in that' phrase over trailing-space fallback", () => {
  const split = __testTakeLine(
    "This man in his 60s had several polyps like these in that spot.",
    54,
    null,
    false
  )
  expect(split.line).toBe("This man in his 60s had several polyps like these")
  expect(split.rest).toBe("in that spot.")
  })

  it("prefers splitting before 'in the' noun phrase for natural flow", () => {
  const split = __testTakeLine(
    "since these symptoms all pointed to compression in the cervical spine.",
    48,
    null,
    false
  )
  expect(split.line).toBe("since these symptoms all pointed to compression")
  expect(split.rest).toBe("in the cervical spine.")
  })

  it("does not split 'After that' into orphaned head + clause", () => {
  const split = __testTakeLine(
    "After that, they went in through the middle and reached the area---the white part they saw was the spinal nerve behind it.",
    54,
    null,
    false
  )
  expect(split.line).not.toBe("After")
  expect(split.rest.toLowerCase().startsWith("that,")).toBe(false)
  })

  it("moves trailing 'behind' before pronoun to the next split chunk", () => {
  const split = __testTakeLine(
    "the white part they saw was the spinal nerve behind it.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" behind")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("behind it")).toBe(true)
  })

  it("does not keep trailing 'from' with pronoun objects", () => {
  const split = __testTakeLine(
    "the team collected blood from it and sent the sample to pathology.",
    30,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" from")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("from it")).toBe(false)
  })

  it("keeps trailing 'under' with determiner noun phrases", () => {
  const split = __testTakeLine(
    "they found pressure under the cervical segment on imaging.",
    30,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" under")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("under the ")).toBe(true)
  })

  it("moves trailing 'for' before possessive noun phrases", () => {
  const split = __testTakeLine(
    "Otherwise, you're just setting a trap for your personal brand.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" for")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("for your ")).toBe(true)
  })

  it("does not keep 'pay attention to' together when splitting", () => {
  const split = __testTakeLine(
    "Fourth, pay attention to your appearance and how you present yourself.",
    24,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith("pay attention to")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("to your appearance")).toBe(true)
  })

  it("avoids one-word fallback heads before attached phrase tails", () => {
  const split = __testTakeLine(
    "After that we completed surgery and closed the incision.",
    12,
    null,
    false
  )
  expect(split.line).not.toBe("After")
  expect(split.rest.toLowerCase().startsWith("that ")).toBe(false)
  })

  it("allows natural fallback splits after how to", () => {
  const split = __testTakeLine(
    "One time, I was teaching a group of managers how to handle emotions at work.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" how to")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("handle ")).toBe(true)
  })

  it("keeps 'in how' together when splitting", () => {
  const split = __testTakeLine(
    "so we naturally keep ourselves in check in how we think and act.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" in")).toBe(false)
  expect(split.line.toLowerCase().endsWith("check")).toBe(true)
  expect(split.rest.toLowerCase().startsWith("in how ")).toBe(true)
  })

  it("keeps 'each other' together when splitting", () => {
  const split = __testTakeLine(
    "That kind of flexibility helps us take care of each other and feel more in control.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" each")).toBe(false)
  expect(/\beach other\b/i.test(split.rest)).toBe(true)
  })

  it("keeps 'one another' together when splitting", () => {
  const split = __testTakeLine(
    "That kind of flexibility helps partners support one another during conflict.",
    52,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" one")).toBe(false)
  expect(/\bone another\b/i.test(split.rest)).toBe(true)
  })

  it("does not keep 'to the' together when trailing-article normalization runs", () => {
  const split = __testTakeLine(
    "The update happened to the release schedule during testing.",
    24,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" to")).toBe(true)
  expect(split.line).toBe("The update happened to")
  expect(split.rest.toLowerCase().startsWith("to the ")).toBe(false)
  })

  it("keeps 'for those' together when splitting", () => {
  const split = __testTakeLine(
    "I'm not trying to make you feel sorry for those people, or just feel sympathy---",
    45,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" for those")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("for those ")).toBe(true)
  })

  it("moves trailing 'the' with acronym phrases", () => {
  const split = __testTakeLine(
    "hugely respected in the U.S.",
    26,
    /(?:^|\s)(?:Mr\.|Mrs\.|Ms\.|Dr\.|U\.S\.|a\.m\.|p\.m\.)$/i,
    true
  )
  expect(split.line).toBe("hugely respected in")
  expect(split.rest).toBe("the U.S.")
  })

  it("keeps coordinated profession phrases together before a who-clause", () => {
  const split = __testTakeLine(
    "An orthopedic surgeon or neurosurgeon who specializes in the spine would perform surgery.",
    40,
    null,
    false
  )
  expect(split.line).toBe("An orthopedic surgeon or neurosurgeon")
  expect(split.rest).toBe("who specializes in the spine would perform surgery.")
  })

  it("keeps reversed coordinated profession phrases together", () => {
  const split = __testTakeLine(
    "A neurosurgeon or orthopedic surgeon would perform surgery.",
    40,
    null,
    false
  )
  expect(split.line).toBe("A neurosurgeon or orthopedic surgeon")
  expect(split.rest).toBe("would perform surgery.")
  })

  it("keeps longer coordinated noun phrases together", () => {
  const split = __testTakeLine(
    "Back pain and numbness and weakness or tingling can worsen overnight.",
    50,
    null,
    false
  )
  expect(split.line).toBe("Back pain and numbness and weakness or tingling")
  expect(split.rest).toBe("can worsen overnight.")
  })

  it("keeps numeric ranges together around 'or'", () => {
  const split = __testTakeLine(
    "It'd been four or five hours since he found his daughter scratching up his truck door.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().endsWith(" four")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("or ")).toBe(false)
  expect(split.line.toLowerCase().includes("four or five")).toBe(true)
  })

  it("keeps short paired noun phrases together before a verb phrase", () => {
  const split = __testTakeLine(
    "my hands and feet are always cold, so every night before bed he warms them up.",
    24,
    null,
    false
  )
  expect(split.line).toBe("my hands and feet")
  expect(split.rest).toBe("are always cold, so every night before bed he warms them up.")
  })

  it("keeps coordinated subject noun phrases together before predicates", () => {
  const split = __testTakeLine(
    "The father and his five-year-old daughter stood at the gate, watching the repaired truck being backed in.",
    54,
    null,
    false
  )
  expect(split.line).not.toBe("The father")
  expect(split.line.toLowerCase().includes("father and his five-year-old daughter")).toBe(true)
  })

  it("prefers splitting before copular verb when no higher-priority cut exists", () => {
  const split = __testTakeLine(
    "Actually, staying quiet and letting himself pause was far more effective than anything he could say.",
    54,
    null,
    false
  )
  expect(split.line).toBe("Actually, staying quiet and letting himself pause")
  expect(split.rest).toBe("was far more effective than anything he could say.")
  })

  it("supports contracted copular negatives in copular fallback splits", () => {
  const split = __testTakeLine(
    "One day, a doctor told him his test results weren't looking good, and that if he didn't make changes, he could face serious health problems later in life.",
    54,
    null,
    false
  )
  expect(split.line.toLowerCase().includes("weren't")).toBe(false)
  expect(split.rest.toLowerCase().startsWith("weren't looking good")).toBe(true)
  })

  it("keeps 'that' at the end of previous line before 'if' clauses", () => {
  const split = __testTakeLine(
    "And then they also told me that if the power went out or the machine broke down, we had to quickly get the beans out by hand.",
    54,
    null,
    false
  )

  expect(split.line).toBe("And then they also told me that")
  expect(split.rest).toBe(
    "if the power went out or the machine broke down, we had to quickly get the beans out by hand."
  )
  })

  it("keeps possessive determiners with following noun phrases", () => {
  const cases = [
    { determiner: "my", noun: "notes" },
    { determiner: "our", noun: "team" },
    { determiner: "their", noun: "plan" },
    { determiner: "its", noun: "shape" },
  ]

  for (const { determiner, noun } of cases) {
    const split = __testTakeLine(
      `We rely on ${determiner} ${noun} during reviews and handoffs.`,
      15,
      null,
      false
    )
    expect(split.line).toBe("We rely on")
    expect(split.rest).toBe(`${determiner} ${noun} during reviews and handoffs.`)
  }
  })

  it("keeps body-part pairs together in inline fill", () => {
  const lines = [
    "00:03:15:18\t00:03:17:24\t常常跟人家炫耀說",
    "00:03:17:24\t00:03:19:08\t他晚上做什麼",
    "00:03:19:08\t00:03:20:09\t他說他太太",
    "00:03:20:09\t00:03:21:25\t因為手腳都是冷的",
    "00:03:21:25\t00:03:24:03\t睡前一定要把它弄熱",
    "00:03:24:03\t00:03:26:05\t所以他用他的身體",
    "00:03:26:05\t00:03:29:09\t在弄熱太太的手跟腳",
  ]
  const selected = new Set(lines.map((_, i) => i))

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "He likes to tell people that my hands and feet are always cold, so every night before bed he warms them up with his own body.",
    { inline: true }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  expect(translations).not.toContain("and feet are always cold,")
  expect(translations.some((line) => line.includes("my hands and feet"))).toBe(true)
  })

  it("avoids strict partial-overlap repeats across adjacent filled slots", () => {
  const lines = [
    "00:20:07:06\t00:20:10:15\t回應的原則非常簡單",
    "00:20:10:15\t00:20:11:17\t有錯就認錯",
    "00:20:11:17\t00:20:13:06\t沒錯就找證據",
    "00:20:13:06\t00:20:14:11\t如果有爭議",
    "00:20:14:11\t00:20:16:05\t我們就啟動調查",
  ]
  const selected = new Set([0, 1, 2, 3, 4])

  const result = fillSelectedTimestampLines(
    lines,
    selected,
    "The rule is simple: admit mistakes, show proof if you're right, and investigate disputes.",
    { maxChars: 42, inline: false }
  )

  const translations = result.lines.filter((line) => !line.includes("\t"))
  for (let i = 1; i < translations.length; i += 1) {
    const prev = (translations[i - 1] ?? "").trim()
    const cur = (translations[i] ?? "").trim()
    if (!prev || !cur || prev === cur) continue
    expect(prev.toLowerCase().includes(cur.toLowerCase())).toBe(false)
  }
  })

  it("does not create joinable adjacent lines during span carry", () => {
  const lines = [
    "00:10:05:14\t00:10:06:22\t他跟我說",
    "00:10:06:22\t00:10:08:22\t方先生你不用擔心",
    "00:10:08:22\t00:10:10:18\t我們的車子都很安全",
    "00:10:10:18\t00:10:12:01\t該有的都有",
    "00:10:12:01\t00:10:13:15\t你要不要直接試車",
    "00:10:13:15\t00:10:14:22\t體驗一下我們的引擎",
    "00:10:14:22\t00:10:16:28\t跟那個貼背感",
  ]
  const selected = new Set(lines.map((_, i) => i))
  const paragraph =
    "He told me not to worry, said the car was very safe and had everything I needed, then asked if I wanted to take it for a test drive and feel the engine."
  const maxChars = 54

  const result = fillSelectedTimestampLines(lines, selected, paragraph, {
    maxChars,
    inline: false,
  })

  const translations = result.lines.filter(
    (line) => line.trim() !== "" && !line.includes("\t")
  )
  for (let i = 0; i < translations.length - 1; i += 1) {
    expect(
      canJoinAdjacentText(translations[i] ?? "", translations[i + 1] ?? "", maxChars)
    ).toBeNull()
  }
  })
})
