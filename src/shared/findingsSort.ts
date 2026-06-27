import type { Finding } from "../analysis/types"

export type FindingWithIndex = {
  finding: Finding
  index: number
}

type SortOptions = {
  typeOrder?: readonly Finding["type"][]
}

function severityRank(finding: Finding): number {
  return "severity" in finding && finding.severity === "error" ? 0 : 1
}

export function sortFindingsWithIndex(
  findings: Finding[],
  options: SortOptions = {}
): FindingWithIndex[] {
  const typeRank = new Map(
    (options.typeOrder ?? []).map((type, index) => [type, index] as const)
  )

  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const aTypeRank = typeRank.get(a.finding.type)
      const bTypeRank = typeRank.get(b.finding.type)
      if (aTypeRank != null || bTypeRank != null) {
        if (aTypeRank == null) return 1
        if (bTypeRank == null) return -1
        const typeRankDiff = aTypeRank - bTypeRank
        if (typeRankDiff !== 0) return typeRankDiff
      }

      const lineDiff = a.finding.lineIndex - b.finding.lineIndex
      if (lineDiff !== 0) return lineDiff

      const severityDiff = severityRank(a.finding) - severityRank(b.finding)
      if (severityDiff !== 0) return severityDiff

      const typeDiff = a.finding.type.localeCompare(b.finding.type)
      if (typeDiff !== 0) return typeDiff

      return a.index - b.index
    })
}
