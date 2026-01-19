import { describe, it, expect } from "vitest"
import { analyzeLines } from "../src/analysis/analyzeLines"
import { capitalizationRule } from "../src/analysis/capitalizationRule"

describe("capitalizationRule", () => {
  it("flags lowercase indigenous and bodhisattvas and ignores proper case", () => {
    const text = [
      "00:00:01:00\t00:00:02:00\tMarker",
      "We support indigenous communities.",
      "Bodhisattva teachings are important.",
      "We honor bodhisattvas today.",
      "00:00:02:00\t00:00:03:00\tMarker",
      "Indigenous leadership matters.",
      "Bodhisattvas are honored here.",
    ].join("\n")

    const metrics = analyzeLines(text, [capitalizationRule()])
    const findings = metrics.filter((m) => m.type === "CAPITALIZATION")

    const tokens = findings.map((f) => f.token).sort()
    expect(tokens).toEqual(["bodhisattvas", "indigenous"])

    const byToken = new Map(findings.map((f) => [f.token, f]))
    expect(byToken.get("indigenous")?.expected).toBe("Indigenous")
    expect(byToken.get("bodhisattvas")?.expected).toBe("Bodhisattvas")
  })
})
