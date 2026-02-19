export type FindingRange = {
  id: string
  from: number
  to: number
}

export function resolveFindingIdAtPos(
  ranges: FindingRange[],
  pos: number,
  preferredId: string | null
): string | null {
  const hits = ranges.filter((r) => pos >= r.from && pos < r.to)
  if (hits.length === 0) return null

  if (preferredId && hits.some((h) => h.id === preferredId)) {
    return preferredId
  }

  const shortest = hits.sort((a, b) => a.to - a.from - (b.to - b.from))[0]
  return shortest?.id ?? null
}

export function resolvePreferredFindingId(
  activeFindingId: string | null,
  pendingClickedFindingId: string | null
): string | null {
  return pendingClickedFindingId ?? activeFindingId
}
