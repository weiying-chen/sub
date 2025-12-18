import { TSV_RE, parseTimecodeToFrames } from './subtitles'

/**
 * Minimal abstraction so this code works with:
 * - string[] (analysis)
 * - CodeMirror doc (adapter)
 */
export type LineSource = {
  lineCount: number
  getLine(index: number): string
}

export type ParsedBlock = {
  tsIndex: number
  payloadIndex: number
  payloadText: string
  startFrames: number
  endFrames: number
}

export type MergedRun = {
  startTsIndex: number
  endTsIndex: number
  startFrames: number
  endFrames: number
  payloadText: string
  payloadIndexStart: number
  payloadIndexEnd: number
}

/**
 * Find the next non-empty, non-timestamp line below a timestamp.
 * Mirrors existing behavior exactly.
 */
function findPayloadBelow(
  src: LineSource,
  tsIndex: number
): { payloadIndex: number | null; payloadText: string } {
  for (let i = tsIndex + 1; i < src.lineCount; i++) {
    const t = src.getLine(i)
    if (TSV_RE.test(t)) break
    if (t.trim() !== '') return { payloadIndex: i, payloadText: t }
  }
  return { payloadIndex: null, payloadText: '' }
}

/**
 * Parse a single timestamp block at tsIndex.
 */
export function parseBlockAt(
  src: LineSource,
  tsIndex: number
): ParsedBlock | null {
  const tsLine = src.getLine(tsIndex)
  const m = tsLine.match(TSV_RE)
  if (!m?.groups) return null

  const startFrames = parseTimecodeToFrames(m.groups.start)
  const endFrames = parseTimecodeToFrames(m.groups.end)
  if (startFrames == null || endFrames == null || endFrames < startFrames) {
    return null
  }

  const { payloadIndex, payloadText } = findPayloadBelow(src, tsIndex)
  if (payloadIndex == null) return null

  return {
    tsIndex,
    payloadIndex,
    payloadText,
    startFrames,
    endFrames,
  }
}

/**
 * Check whether this block is a continuation of a previous identical block.
 * Used to suppress duplicate metrics.
 */
export function isContinuationOfPrevious(
  src: LineSource,
  block: ParsedBlock
): boolean {
  for (let i = block.tsIndex - 1; i >= 0; i--) {
    const prev = parseBlockAt(src, i)
    if (!prev) continue

    const isContinuation =
      prev.payloadText === block.payloadText &&
      prev.endFrames === block.startFrames

    return isContinuation
  }
  return false
}

/**
 * Merge forward from a starting block to form a contiguous run
 * with identical payload and contiguous timing.
 */
export function mergeForward(
  src: LineSource,
  first: ParsedBlock
): MergedRun {
  let mergedEndFrames = first.endFrames
  let scanTs = first.tsIndex

  let payloadIndexEnd = first.payloadIndex
  let endTsIndex = first.tsIndex

  while (true) {
    let nextTs: number | null = null

    for (let j = scanTs + 1; j < src.lineCount; j++) {
      if (TSV_RE.test(src.getLine(j))) {
        nextTs = j
        break
      }
    }

    if (nextTs == null) break

    const next = parseBlockAt(src, nextTs)
    if (
      next &&
      next.payloadText === first.payloadText &&
      next.startFrames === mergedEndFrames
    ) {
      mergedEndFrames = next.endFrames
      scanTs = next.tsIndex
      endTsIndex = next.tsIndex
      payloadIndexEnd = next.payloadIndex
      continue
    }

    break
  }

  return {
    startTsIndex: first.tsIndex,
    endTsIndex,
    startFrames: first.startFrames,
    endFrames: mergedEndFrames,
    payloadText: first.payloadText,
    payloadIndexStart: first.payloadIndex,
    payloadIndexEnd,
  }
}
