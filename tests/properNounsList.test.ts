import { describe, expect, it } from "vitest"

import { loadProperNouns, loadTermVariants } from "../src/cli/properNouns"

describe("loadProperNouns", () => {
  it("includes key Buddhist terms in the default proper noun list", async () => {
    const properNouns = await loadProperNouns()

    expect(properNouns).not.toBeNull()
    expect(properNouns).toContain("Tzu Chi")
    expect(properNouns).toContain("Guanyin Bodhisattva")
    expect(properNouns).toContain("Bodhisattva")
    expect(properNouns).toContain("Venerable Master Cheng Yen")
    expect(properNouns).toContain("Emperor Yao")
  })
})

describe("loadTermVariants", () => {
  it("loads canonical term mappings", async () => {
    const entries = await loadTermVariants()

    expect(entries).not.toBeNull()
    expect(entries).toContainEqual({
      variant: "Pingdong",
      canonical: "Pingtung",
    })
  })
})
