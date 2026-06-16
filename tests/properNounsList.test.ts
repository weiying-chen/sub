import { describe, expect, it } from "vitest"

import {
  loadAbbreviations,
  loadCapitalizationTerms,
  loadProperNouns,
  loadTermVariants,
} from "../src/cli/properNouns"

describe("loadProperNouns", () => {
  it("includes key Buddhist terms in the default proper noun list", async () => {
    const properNouns = await loadProperNouns()

    expect(properNouns).not.toBeNull()
    expect(properNouns).toContain("Tzu Chi")
    expect(properNouns).toContain("Guanyin Bodhisattva")
    expect(properNouns).toContain("Bodhisattva")
    expect(properNouns).toContain("Dharma")
    expect(properNouns).toContain("Venerable Master Cheng Yen")
    expect(properNouns).toContain("Emperor Yao")
    expect(properNouns).toContain("Vice Superintendent")
    expect(properNouns).toContain("Vice Supt.")
    expect(properNouns).toContain("Layman")
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

describe("loadAbbreviations", () => {
  it("includes title abbreviations in the default punctuation list", async () => {
    const abbreviations = await loadAbbreviations()

    expect(abbreviations).not.toBeNull()
    expect(abbreviations).toContain("Dr.")
    expect(abbreviations).toContain("Mr.")
    expect(abbreviations).toContain("Supt.")
  })
})

describe("loadCapitalizationTerms", () => {
  it("includes required sentence-case religious terms", async () => {
    const capitalizationTerms = await loadCapitalizationTerms()

    expect(capitalizationTerms).not.toBeNull()
    expect(capitalizationTerms).toContain("the Bodhisattva Path")
    expect(capitalizationTerms).toContain("Chinese")
    expect(capitalizationTerms).toContain("Japanese")
    expect(capitalizationTerms).toContain("Harmony-preserving Pill")
    expect(capitalizationTerms).not.toContain("Grandma")
    expect(capitalizationTerms).not.toContain("Grandpa")
  })
})
