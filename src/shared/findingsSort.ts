import type { Finding } from "../analysis/types"

export type FindingWithIndex = {
  finding: Finding
  index: number
}

function severityRank(finding: Finding): number {
  return "severity" in finding && finding.severity === "error" ? 0 : 1
}

export function sortFindingsWithIndex(findings: Finding[]): FindingWithIndex[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const severityDiff = severityRank(a.finding) - severityRank(b.finding)
      if (severityDiff !== 0) return severityDiff

      const lineDiff = a.finding.lineIndex - b.finding.lineIndex
      if (lineDiff !== 0) return lineDiff

      const typeDiff = a.finding.type.localeCompare(b.finding.type)
      if (typeDiff !== 0) return typeDiff

      return a.index - b.index
    })
}
