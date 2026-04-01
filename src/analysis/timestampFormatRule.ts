import type { SegmentCtx, SegmentRule } from "./segments"
import type { TimestampFormatMetric } from "./types"
import { parseTimecodeToFrames } from "../shared/subtitles"

const STRICT_TSV_RE =
  /^(?:(?:XXX)\s+)?(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

const LOOSE_TSV_RE =
  /^(?<prefix>.*?)(?<start>\d{1,2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{1,2}:\d{2}:\d{2}:\d{2})\t+.*$/

function looksLikeTimestampRow(line: string): boolean {
  if (!line.includes("\t")) return false
  return /\d{1,2}:\d{2}:\d{2}:\d{2}/.test(line)
}

export function timestampFormatRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    if (!ctx.lines || ctx.segmentIndex !== 0) return []

    const metrics: TimestampFormatMetric[] = []
    for (let i = 0; i < ctx.lines.length; i += 1) {
      const line = ctx.lines[i] ?? ""

      const strict = line.match(STRICT_TSV_RE)
      if (strict?.groups) {
        const start = parseTimecodeToFrames(strict.groups.start)
        const end = parseTimecodeToFrames(strict.groups.end)
        if (start == null || end == null || end < start) {
          metrics.push({
            type: "TIMESTAMP_FORMAT",
            lineIndex: i,
            ruleCode: "INVALID_TIMECODE",
            text: line.trim(),
          })
        }
        continue
      }

      if (!looksLikeTimestampRow(line)) continue
      if (!LOOSE_TSV_RE.test(line)) continue

      metrics.push({
        type: "TIMESTAMP_FORMAT",
        lineIndex: i,
        ruleCode: "INVALID_FORMAT",
        text: line.trim(),
      })
    }

    return metrics
  }
}
