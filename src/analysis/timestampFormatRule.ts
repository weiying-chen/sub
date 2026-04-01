import type { SegmentCtx, SegmentRule } from "./segments"
import type { TimestampFormatMetric } from "./types"

const STRICT_TSV_RE =
  /^(?:(?:XXX)\s+)?\d{2}:\d{2}:\d{2}:\d{2}\t+\d{2}:\d{2}:\d{2}:\d{2}\t+.*$/

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

      if (STRICT_TSV_RE.test(line)) {
        continue
      }

      if (!looksLikeTimestampRow(line)) continue
      if (!LOOSE_TSV_RE.test(line)) continue

      metrics.push({
        type: "TIMESTAMP_FORMAT",
        lineIndex: i,
        text: line.trim(),
      })
    }

    return metrics
  }
}
