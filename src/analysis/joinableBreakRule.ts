import type { JoinableBreakMetric } from "./types"
import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import { hasEmptyLineBetween, type LineSource, type ParseBlockOptions } from "../shared/tsvRuns"
import { DEFAULT_MAX_CHARS } from "../shared/maxChars"
import { canJoinAdjacentText } from "../shared/joinableText"
import { looksLikeSentenceFragment } from "../shared/sentenceFragments"

type JoinableBreakRuleOptions = ParseBlockOptions & {
  maxGapFrames?: number
  maxJoinedChars?: number
}

const DEFAULT_MAX_GAP_FRAMES = 30
const COMMA_END_RE = /[,，]\s*$/
const SENTENCE_END_RE = /[.!?]["')\]]*\s*$/

function isFullSentence(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!SENTENCE_END_RE.test(trimmed)) return false
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
    if (!next) return []
    if (!hasTiming(cur) || !hasTiming(next)) return []

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

    if (!isFullSentence(cur.translation) || !isFullSentence(next.translation)) {
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

    const join = canJoinAdjacentText(cur.translation, next.translation, maxJoinedChars, {
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
