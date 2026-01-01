export type MarkerScope = {
  start: number
  end: number
}

export function findMarkerScope(
  lines: string[],
  marker = '@@'
): MarkerScope | null {
  let markerIndex = -1

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]?.trim() === marker) {
      markerIndex = i
    }
  }

  if (markerIndex < 0) return null

  const start = markerIndex + 1
  if (start >= lines.length) return null

  let end = lines.length - 1
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i]?.trim() === '') {
      end = i - 1
      break
    }
  }

  if (end < start) return null
  return { start, end }
}
