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
      instruction: "Shorten this translation to 54 characters or fewer.",
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
})
