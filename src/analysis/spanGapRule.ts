import type { Segment, SegmentCtx, SegmentRule } from "./segments"
import type { SpanGapMetric } from "./types"

const MIN_SPAN_GAP_FRAMES = 3

function hasTiming(
  segment: Segment
): segment is Segment & { startFrames: number; endFrames: number } {
  return (
    typeof segment.startFrames === "number" &&
    typeof segment.endFrames === "number"
  )
}

function normalizeTextForCompare(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase()
}

export function spanGapRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    const cur = ctx.segment
    const next = ctx.segments[ctx.segmentIndex + 1]
    if (!next) return []
    if (!hasTiming(cur) || !hasTiming(next)) return []

    const gapFrames = next.startFrames - cur.endFrames
    if (gapFrames < MIN_SPAN_GAP_FRAMES) return []

    const left = normalizeTextForCompare(cur.translation)
    const right = normalizeTextForCompare(next.translation)
    if (!left || left !== right) return []

    const metric: SpanGapMetric = {
      type: "SPAN_GAP",
      lineIndex: cur.lineIndex,
      nextLineIndex: next.lineIndex,
      text: cur.translation,
      nextText: next.translation,
      gapFrames,
      instruction:
        "This translation disappears and reappears after a timing gap. Split or rewrite it instead of spanning across it.",
    }

    return [metric]
  }
}
