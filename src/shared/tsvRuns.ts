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
  translationLines: string[]
  translationIndices: number[]
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

export function isSubsCommentLine(text: string): boolean {
  return text.trimStart().startsWith('//')
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
): {
  translationIndex: number | null
  translation: string
  translationLines: string[]
  translationIndices: number[]
} {
  const isReferenceUrlLine = (text: string): boolean =>
    /^(https?:\/\/|www\.)\S+$/i.test(text)
  const endsTerminalPunctuation = (text: string): boolean =>
    /[.!?…:](?:["'\)\]\}]+)?\s*$/.test(text)
  const startsLikelyNewSentence = (text: string): boolean =>
    /^[A-Z0-9]/.test(text.trimStart())

  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  const translationLines: string[] = []
  const translationIndices: number[] = []
  let translationIndex: number | null = null

  for (let i = tsIndex + 1; i < src.lineCount; i++) {
    const t = src.getLine(i)
    if (TSV_RE.test(t)) break
    if (isSubsCommentLine(t)) {
      if (translationLines.length === 0) continue
      break
    }
    if (t.trim() === '') {
      if (ignoreEmptyLines) continue
      break
    }
    if (isReferenceUrlLine(t.trim())) {
      if (translationLines.length === 0) {
        translationIndex = i
        translationLines.push(t)
        translationIndices.push(i)
      }
      break
    }
    if (translationLines.length > 0) {
      const prev = translationLines[translationLines.length - 1] ?? ''
      if (
        endsTerminalPunctuation(prev) &&
        startsLikelyNewSentence(t)
      ) {
        break
      }
    }
    if (translationIndex == null) translationIndex = i
    translationLines.push(t)
    translationIndices.push(i)
  }

  if (translationIndex == null) {
    return {
      translationIndex: null,
      translation: '',
      translationLines: [],
      translationIndices: [],
    }
  }

  return {
    translationIndex,
    translation: translationLines.join(''),
    translationLines,
    translationIndices,
  }
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

  const { translationIndex, translation, translationLines, translationIndices } = findTranslationBelow(
    src,
    tsIndex,
    options
  )
  if (translationIndex == null) return null

  return {
    tsIndex,
    translationIndex,
    translation,
    translationLines,
    translationIndices,
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
