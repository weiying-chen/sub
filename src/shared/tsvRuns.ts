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
  translationIndex: number
  translation: string
  startFrames: number
  endFrames: number
}

export type MergedRun = {
  startTsIndex: number
  endTsIndex: number
  startFrames: number
  endFrames: number
  translation: string
  translationIndexStart: number
  translationIndexEnd: number
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
function findTranslationBelow(
  src: LineSource,
  tsIndex: number,
  options: ParseBlockOptions = {}
): { translationIndex: number | null; translation: string } {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  for (let i = tsIndex + 1; i < src.lineCount; i++) {
    const t = src.getLine(i)
    if (TSV_RE.test(t)) break
    if (t.trim() === '') {
      if (ignoreEmptyLines) continue
      return { translationIndex: null, translation: '' }
    }
    return { translationIndex: i, translation: t }
  }
  return { translationIndex: null, translation: '' }
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

  const { translationIndex, translation } = findTranslationBelow(
    src,
    tsIndex,
    options
  )
  if (translationIndex == null) return null

  return {
    tsIndex,
    translationIndex,
    translation,
    startFrames,
    endFrames,
  }
}

/**
 * Check whether this block is a continuation of a previous identical block.
 * Used to suppress duplicate metrics.
 *
 * New behavior: if the previous parsed block has the same translation, suppress this one
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
      hasEmptyLineBetween(src, prev.translationIndex, block.tsIndex)
    ) {
      return false
    }

    const isContinuation = prev.translation === block.translation
    return isContinuation
  }
  return false
}

/**
 * Merge forward from a starting block to form a run with identical translation.
 *
 * New behavior: merges adjacent timestamp blocks as long as translation matches,
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

  let translationIndexEnd = first.translationIndex
  let endTsIndex = first.tsIndex

  while (true) {
    const nextTs = findNextTimestampIndex(src, scanTs)

    if (nextTs == null) break

    if (!ignoreEmptyLines && hasEmptyLineBetween(src, translationIndexEnd, nextTs)) {
      break
    }

    const next = parseBlockAt(src, nextTs, options)
    if (next && next.translation === first.translation) {
      mergedEndFrames = next.endFrames
      scanTs = next.tsIndex
      endTsIndex = next.tsIndex
      translationIndexEnd = next.translationIndex
      continue
    }

    break
  }

  return {
    startTsIndex: first.tsIndex,
    endTsIndex,
    startFrames: first.startFrames,
    endFrames: mergedEndFrames,
    translation: first.translation,
    translationIndexStart: first.translationIndex,
    translationIndexEnd,
  }
}

export function mergedRunTranslationIndices(
  src: LineSource,
  first: ParsedBlock,
  options: ParseBlockOptions = {}
): number[] {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  const translationIndices = [first.translationIndex]
  let scanTs = first.tsIndex
  let lastTranslationIndex = first.translationIndex

  while (true) {
    const nextTs = findNextTimestampIndex(src, scanTs)
    if (nextTs == null) break

    if (!ignoreEmptyLines && hasEmptyLineBetween(src, lastTranslationIndex, nextTs)) {
      break
    }

    const next = parseBlockAt(src, nextTs, options)
    if (!next || next.translation !== first.translation) break

    translationIndices.push(next.translationIndex)
    scanTs = next.tsIndex
    lastTranslationIndex = next.translationIndex
  }

  return translationIndices
}
