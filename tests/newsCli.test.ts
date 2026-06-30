import { describe, expect, it } from "vitest"

import { formatFinding } from "../src/cli/news"

const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

describe("news CLI reporter", () => {
  it("colors errors red and warnings yellow by severity", async () => {
    const errorOutput = formatFinding({
      type: "MAX_CHARS",
      lineIndex: 6,
      text: "This line is too long.",
      maxAllowed: 54,
      actual: 80,
      severity: "error",
      instruction: "Shorten this translation line to 54 characters or fewer.",
    })

    const warnOutput = formatFinding({
      type: "MIN_CPS",
      lineIndex: 2,
      text: "Short.",
      severity: "warn",
      instruction: "Increase reading speed.",
    })

    expect(errorOutput).toContain(`${RED}ERROR${RESET}  MAX_CHARS`)
    expect(warnOutput).toContain(`${YELLOW}WARN${RESET}  MIN_CPS`)
  })

  it("formats style enum values as readable CLI text", () => {
    const output = formatFinding({
      type: "DASH_STYLE",
      lineIndex: 0,
      index: 10,
      token: "—",
      text: "This drifts—apart.",
      expected: "triple_hyphen",
      found: "em_dash",
      blockType: "subs",
      severity: "error",
      instruction: "Use triple hyphens (---) for this text type.",
    })

    expect(output).toContain("found: em dash")
    expect(output).toContain("expected: triple hyphens")
    expect(output).not.toContain("found: em_dash")
    expect(output).not.toContain("expected: triple_hyphen")
  })
})
