import type { JoinableBreakMetric } from "./types"
import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import { hasEmptyLineBetween, type LineSource, type ParseBlockOptions } from "../shared/tsvRuns"
import { DEFAULT_MAX_CHARS } from "../shared/maxChars"
import { canJoinAdjacentText } from "../shared/joinableText"

type JoinableBreakRuleOptions = ParseBlockOptions & {
  maxGapFrames?: number
  maxJoinedChars?: number
}

const DEFAULT_MAX_GAP_FRAMES = 30

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
