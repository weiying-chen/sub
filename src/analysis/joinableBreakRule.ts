import type { JoinableBreakMetric } from "./types"
import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import { hasEmptyLineBetween, type LineSource, type ParseBlockOptions } from "../shared/tsvRuns"
import { DEFAULT_MAX_CHARS } from "../shared/maxChars"
import { looksLikeSentenceFragment } from "../shared/sentenceFragments"

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

function normalizeJoinText(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

function endsWithPeriod(text: string): boolean {
  return /\.\s*(?:["')\]]\s*)?$/.test(text)
}

function endsWithSentencePunctuation(text: string): boolean {
  return /[.!?,]\s*(?:["')\]]\s*)?$/.test(text)
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

    const left = normalizeJoinText(cur.translation)
    const right = normalizeJoinText(next.translation)
    if (!left || !right) return []
    if (left === right) return []
    if (looksLikeSentenceFragment(left) && endsWithPeriod(left)) return []
    if (!endsWithSentencePunctuation(right)) return []

    const joined = `${left} ${right}`.trim()
    if (joined.length > maxJoinedChars) return []

    const metric: JoinableBreakMetric = {
      type: "JOINABLE_BREAK",
      lineIndex: cur.lineIndex,
      nextLineIndex: next.lineIndex,
      text: cur.translation,
      nextText: next.translation,
      gapFrames,
      joinedLength: joined.length,
      maxJoinedChars,
    }

    return [metric]
  }
}
