import type { MergeCandidateMetric } from "./types"
import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import { hasEmptyLineBetween, type LineSource, type ParseBlockOptions } from "../shared/tsvRuns"

type MergeCandidateRuleOptions = ParseBlockOptions & {
  maxGapFrames?: number
  maxEditDistance?: number
}

const DEFAULT_MAX_GAP_FRAMES = 30
const DEFAULT_MAX_EDIT_DISTANCE = 2

function hasTiming(
  segment: Segment
): segment is Segment & { tsIndex: number; startFrames: number; endFrames: number } {
  return (
    typeof segment.tsIndex === "number" &&
    typeof segment.startFrames === "number" &&
    typeof segment.endFrames === "number"
  )
}

function normalizeTextForCompare(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase()
}

function boundedLevenshtein(
  a: string,
  b: string,
  maxDistance: number
): number | null {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > maxDistance) return null

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const next = new Array<number>(b.length + 1)
    next[0] = i
    let rowMin = next[0]

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const del = prev[j] + 1
      const ins = next[j - 1] + 1
      const sub = prev[j - 1] + cost
      const v = Math.min(del, ins, sub)
      next[j] = v
      if (v < rowMin) rowMin = v
    }

    if (rowMin > maxDistance) return null
    prev = next
  }

  const distance = prev[b.length]
  return distance <= maxDistance ? distance : null
}

export function mergeCandidateRule(
  options: MergeCandidateRuleOptions = {}
): SegmentRule {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  const maxGapFrames = options.maxGapFrames ?? DEFAULT_MAX_GAP_FRAMES
  const maxEditDistance = options.maxEditDistance ?? DEFAULT_MAX_EDIT_DISTANCE

  return (ctx: SegmentCtx) => {
    const cur = ctx.segment
    const next = ctx.segments[ctx.segmentIndex + 1]
    if (!next) return []
    if (!hasTiming(cur) || !hasTiming(next)) return []

    if (!ignoreEmptyLines && ctx.lines) {
      if (typeof cur.payloadIndex !== "number" || typeof next.tsIndex !== "number") {
        return []
      }
      const src: LineSource = {
        lineCount: ctx.lines.length,
        getLine: (i) => ctx.lines?.[i] ?? "",
      }
      if (hasEmptyLineBetween(src, cur.payloadIndex, next.tsIndex)) {
        return []
      }
    }

    const gapFrames = next.startFrames - cur.endFrames
    if (gapFrames < 0 || gapFrames > maxGapFrames) return []

    const left = normalizeTextForCompare(cur.text)
    const right = normalizeTextForCompare(next.text)
    if (!left || !right || left === right) return []

    const editDistance = boundedLevenshtein(left, right, maxEditDistance)
    if (editDistance == null) return []

    const metric: MergeCandidateMetric = {
      type: "MERGE_CANDIDATE",
      lineIndex: cur.lineIndex,
      nextLineIndex: next.lineIndex,
      text: cur.text,
      nextText: next.text,
      gapFrames,
      editDistance,
      message:
        "These adjacent lines are very similar and close in time; consider merging them into one timestamp span.",
    }

    return [metric]
  }
}
