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

export type ParseBlockOptions = {
  ignoreEmptyLines?: boolean
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

function findNextTimestampIndex(src: LineSource, fromTsIndex: number): number | null {
  for (let j = fromTsIndex + 1; j < src.lineCount; j++) {
    if (TSV_RE.test(src.getLine(j))) {
      return j
    }
  }
  return null
}

/**
 * Find the next non-empty, non-timestamp line below a timestamp.
 * Mirrors existing behavior exactly.
 */
function findPayloadBelow(
  src: LineSource,
  tsIndex: number,
  options: ParseBlockOptions = {}
): { payloadIndex: number | null; payloadText: string } {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  for (let i = tsIndex + 1; i < src.lineCount; i++) {
    const t = src.getLine(i)
    if (TSV_RE.test(t)) break
    if (t.trim() === '') {
      if (ignoreEmptyLines) continue
      return { payloadIndex: null, payloadText: '' }
    }
    return { payloadIndex: i, payloadText: t }
  }
  return { payloadIndex: null, payloadText: '' }
}

export function hasEmptyLineBetween(
  src: LineSource,
  startIndex: number,
  endIndex: number
): boolean {
  for (let i = startIndex + 1; i < endIndex; i++) {
    if (src.getLine(i).trim() === '') return true
  }
  return false
}

/**
 * Parse a single timestamp block at tsIndex.
 */
export function parseBlockAt(
  src: LineSource,
  tsIndex: number,
  options: ParseBlockOptions = {}
): ParsedBlock | null {
  const tsLine = src.getLine(tsIndex)
  const m = tsLine.match(TSV_RE)
  if (!m?.groups) return null

  const startFrames = parseTimecodeToFrames(m.groups.start)
  const endFrames = parseTimecodeToFrames(m.groups.end)
  if (startFrames == null || endFrames == null || endFrames < startFrames) {
    return null
  }

  const { payloadIndex, payloadText } = findPayloadBelow(
    src,
    tsIndex,
    options
  )
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
 *
 * New behavior: if the previous parsed block has the same payload, suppress this one
 * regardless of whether the timing is contiguous.
 */
export function isContinuationOfPrevious(
  src: LineSource,
  block: ParsedBlock,
  options: ParseBlockOptions = {}
): boolean {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  for (let i = block.tsIndex - 1; i >= 0; i--) {
    const prev = parseBlockAt(src, i, options)
    if (!prev) continue

    if (
      !ignoreEmptyLines &&
      hasEmptyLineBetween(src, prev.payloadIndex, block.tsIndex)
    ) {
      return false
    }

    const isContinuation = prev.payloadText === block.payloadText
    return isContinuation
  }
  return false
}

/**
 * Merge forward from a starting block to form a run with identical payload.
 *
 * New behavior: merges adjacent timestamp blocks as long as payloadText matches,
 * regardless of gaps in timing.
 */
export function mergeForward(
  src: LineSource,
  first: ParsedBlock,
  options: ParseBlockOptions = {}
): MergedRun {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  let mergedEndFrames = first.endFrames
  let scanTs = first.tsIndex

  let payloadIndexEnd = first.payloadIndex
  let endTsIndex = first.tsIndex

  while (true) {
    const nextTs = findNextTimestampIndex(src, scanTs)

    if (nextTs == null) break

    if (!ignoreEmptyLines && hasEmptyLineBetween(src, payloadIndexEnd, nextTs)) {
      break
    }

    const next = parseBlockAt(src, nextTs, options)
    if (next && next.payloadText === first.payloadText) {
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

export function mergedRunPayloadIndices(
  src: LineSource,
  first: ParsedBlock,
  options: ParseBlockOptions = {}
): number[] {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  const payloadIndices = [first.payloadIndex]
  let scanTs = first.tsIndex
  let lastPayloadIndex = first.payloadIndex

  while (true) {
    const nextTs = findNextTimestampIndex(src, scanTs)
    if (nextTs == null) break

    if (!ignoreEmptyLines && hasEmptyLineBetween(src, lastPayloadIndex, nextTs)) {
      break
    }

    const next = parseBlockAt(src, nextTs, options)
    if (!next || next.payloadText !== first.payloadText) break

    payloadIndices.push(next.payloadIndex)
    scanTs = next.tsIndex
    lastPayloadIndex = next.payloadIndex
  }

  return payloadIndices
}
