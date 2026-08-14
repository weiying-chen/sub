import type { JoinableBreakMetric } from "./types"
import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import { suppressesBoundarySuggestions } from "./segments"
import { hasEmptyLineBetween, type LineSource, type ParseBlockOptions } from "../shared/tsvRuns"
import { DEFAULT_MAX_CHARS } from "../shared/maxChars"
import { canJoinAdjacentText, normalizeJoinText } from "../shared/joinableText"
import { looksLikeSentenceFragment } from "../shared/sentenceFragments"

type JoinableBreakRuleOptions = ParseBlockOptions & {
  maxGapFrames?: number
  maxJoinedChars?: number
}

const DEFAULT_MAX_GAP_FRAMES = 0
const COMMA_END_RE = /[,，]\s*$/
const SENTENCE_END_RE = /[.!?]["')\]]*\s*$/
const TRAILING_ABBREV_FRAGMENT_RE = /(?:^|[\s"'([])([A-Za-z]{1,4}\.)["')\]]*\s*$/
const LEADING_ABBREV_FRAGMENT_RE = /^["'([{]*([A-Za-z]{1,4}\.)/

function hasSplitAbbreviationBoundary(left: string, right: string): boolean {
  const leftMatch = left.trim().match(TRAILING_ABBREV_FRAGMENT_RE)
  const rightMatch = right.trim().match(LEADING_ABBREV_FRAGMENT_RE)
  if (!leftMatch || !rightMatch) return false

  const combined = `${leftMatch[1]}${rightMatch[1]}`
  return /^(?:[A-Za-z]{1,4}\.){2,}$/.test(combined)
}

function isSingleWordTerminalSentence(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || !SENTENCE_END_RE.test(trimmed)) return false

  const words = extractSentenceWords(trimmed)

  if (words.length !== 1) return false
  const first = words[0] ?? ""
  if (first === "") return false
  return first[0] === first[0].toUpperCase()
}

function extractSentenceWords(text: string): string[] {
  return text
    .replace(/^["'([{]+|["')\]}]+$/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ""))
    .filter(Boolean)
}

function isMultiWordQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (!/[?]["')\]]*\s*$/.test(trimmed)) return false
  return extractSentenceWords(trimmed).length > 1
}

function isFullSentence(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!SENTENCE_END_RE.test(trimmed)) return false
  if (isSingleWordTerminalSentence(trimmed)) return true
  if (looksLikeSentenceFragment(trimmed)) return false
  return true
}

function hasTiming(
  segment: Segment
): segment is Segment & { tsIndex: number; startFrames: number; endFrames: number } {
  return (
    typeof segment.tsIndex === "number" &&
    typeof segment.startFrames === "number" &&
    typeof segment.endFrames === "number"
  )
}

type BoundaryClass =
  | "duplicate_pair_before_multi_word_question"
  | "mismatched_sentence_state"
  | "join_candidate"

type BoundaryInfo = {
  splitAbbreviationBoundary: boolean
  curFullSentence: boolean
  nextFullSentence: boolean
  prevMatchesCur: boolean
  curMatchesNext: boolean
  nextMatchesNext2: boolean
}

function isSameTranslationText(left: string, right: string): boolean {
  return normalizeJoinText(left) === normalizeJoinText(right)
}

function getBoundaryInfo(
  prev: Segment | undefined,
  cur: Segment,
  next: Segment,
  next2: Segment | undefined,
  curText: string,
  nextText: string
): BoundaryInfo {
  return {
    splitAbbreviationBoundary: hasSplitAbbreviationBoundary(
      curText,
      nextText
    ),
    curFullSentence: isFullSentence(curText),
    nextFullSentence: isFullSentence(nextText),
    prevMatchesCur: prev?.translation === cur.translation,
    curMatchesNext: cur.translation === next.translation,
    nextMatchesNext2: next2?.translation === next.translation,
  }
}

function classifyBoundary(
  info: BoundaryInfo,
  next: Segment,
  next2: Segment | undefined
): BoundaryClass {
  if (
    info.curMatchesNext &&
    info.curFullSentence &&
    info.nextFullSentence &&
    next2 &&
    isMultiWordQuestion(next2.translation)
  ) {
    return "duplicate_pair_before_multi_word_question"
  }

  if (
    !info.splitAbbreviationBoundary &&
    info.curFullSentence !== info.nextFullSentence
  ) {
    return "mismatched_sentence_state"
  }

  return "join_candidate"
}

export function joinableBreakRule(
  options: JoinableBreakRuleOptions = {}
): SegmentRule {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  const maxGapFrames = options.maxGapFrames ?? DEFAULT_MAX_GAP_FRAMES
  const maxJoinedChars = Math.max(1, options.maxJoinedChars ?? DEFAULT_MAX_CHARS)

  return (ctx: SegmentCtx) => {
    const cur = ctx.segment
    const prev = ctx.segmentIndex > 0 ? ctx.segments[ctx.segmentIndex - 1] : undefined
    const next = ctx.segments[ctx.segmentIndex + 1]
    const next2 = ctx.segments[ctx.segmentIndex + 2]
    if (!next) return []
    if (!hasTiming(cur) || !hasTiming(next)) return []
    if (suppressesBoundarySuggestions(cur) || suppressesBoundarySuggestions(next)) return []

    if (!ignoreEmptyLines && ctx.lines) {
      if (typeof cur.translationIndex !== "number" || typeof next.tsIndex !== "number") {
        return []
      }
      const src: LineSource = {
        lineCount: ctx.lines.length,
        getLine: (i) => ctx.lines?.[i] ?? "",
      }
      if (hasEmptyLineBetween(src, cur.translationIndex, next.tsIndex)) {
        return []
      }
    }

    const gapFrames = next.startFrames - cur.endFrames
    if (gapFrames < 0 || gapFrames > maxGapFrames) return []

    const curText = cur.translation
    const nextText = next.translation
    if (isSameTranslationText(curText, nextText)) return []

    const boundaryInfo = getBoundaryInfo(prev, cur, next, next2, curText, nextText)
    const boundaryClass = classifyBoundary(boundaryInfo, next, next2)
    if (boundaryClass !== "join_candidate") {
      return []
    }

    // If `cur` already completes a comma-ended previous line, prefer that
    // boundary and avoid flagging an additional join from `cur` to `next`.
    if (
      prev &&
      hasTiming(prev) &&
      COMMA_END_RE.test(prev.translation.trim()) &&
      SENTENCE_END_RE.test(cur.translation.trim())
    ) {
      const prevGapFrames = cur.startFrames - prev.endFrames
      if (prevGapFrames >= 0 && prevGapFrames <= maxGapFrames) {
        const prevJoin = canJoinAdjacentText(prev.translation, cur.translation, maxJoinedChars, {
          allowSentenceEndJoin: true,
        })
        if (prevJoin) return []
        return []
      }
    }

    const join = boundaryInfo.splitAbbreviationBoundary
      ? {
          joined: `${normalizeJoinText(curText)} ${normalizeJoinText(nextText)}`.trim(),
          joinedLength: `${normalizeJoinText(curText)} ${normalizeJoinText(nextText)}`
            .trim()
            .length,
        }
      : canJoinAdjacentText(curText, nextText, maxJoinedChars, {
          allowSentenceEndJoin: true,
        })
    if (!join) return []

    const metric: JoinableBreakMetric = {
      type: "JOINABLE_BREAK",
      lineIndex: cur.lineIndex,
      nextLineIndex: next.lineIndex,
      text: cur.translation,
      nextText: next.translation,
      gapFrames,
      joinedLength: join.joinedLength,
      maxJoinedChars,
    }

    return [metric]
  }
}
