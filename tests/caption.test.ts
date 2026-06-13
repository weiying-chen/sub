import { describe, expect, it } from "vitest"

import {
  isCaptionBlock,
  isCaptionLine,
} from "../src/analysis/caption"

describe("caption helpers", () => {
  it("recognizes caption lines", () => {
    expect(isCaptionLine("(Hello.)")).toBe(true)
    expect(isCaptionLine("（Hello。）")).toBe(true)
    expect(isCaptionLine("Hello.")).toBe(false)
    expect(isCaptionLine("(Hello.) extra")).toBe(false)
  })

  it("recognizes caption blocks", () => {
    expect(
      isCaptionBlock([
        { lineIndex: 1, lineText: "(Hello" },
        { lineIndex: 2, lineText: "world.)" },
      ])
    ).toBe(true)

    expect(isCaptionBlock([{ lineIndex: 1, lineText: "Hello." }])).toBe(false)
  })
})
