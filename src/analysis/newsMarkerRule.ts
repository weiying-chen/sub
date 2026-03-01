import type { NewsMarker } from './segments'
import type { SegmentCtx, SegmentRule } from './segments'
import type { Metric } from './types'

export type NewsMarkerRuleCode =
  | 'INVALID_FORMAT'
  | 'NON_SEQUENTIAL_INDEX'
  | 'NON_INCREASING_TIME'

export type NewsMarkerMetric = {
  type: 'NEWS_MARKER'
  lineIndex: number
  blockType: 'vo' | 'super'
  markerRaw: string
  ruleCode: NewsMarkerRuleCode
  prevMarkerRaw?: string
  severity?: 'error' | 'warn'
}

function getPreviousValidMarker(
  segments: SegmentCtx['segments'],
  segmentIndex: number
): NewsMarker | null {
  for (let i = segmentIndex - 1; i >= 0; i -= 1) {
    const marker = segments[i]?.marker
    if (marker?.valid) return marker
  }
  return null
}

export function newsMarkerRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const { segment, segmentIndex, segments } = ctx
    const blockType = segment.blockType
    if (blockType !== 'vo' && blockType !== 'super') return []

    const marker = segment.marker
    if (!marker) return []

    const metrics: Metric[] = []

    if (!marker.valid) {
      metrics.push({
        type: 'NEWS_MARKER',
        lineIndex: marker.lineIndex,
        blockType,
        markerRaw: marker.raw,
        ruleCode: 'INVALID_FORMAT',
      } satisfies NewsMarkerMetric)
      return metrics
    }

    const prev = getPreviousValidMarker(segments, segmentIndex)
    if (!prev) return metrics

    if (marker.index !== prev.index! + 1) {
      metrics.push({
        type: 'NEWS_MARKER',
        lineIndex: marker.lineIndex,
        blockType,
        markerRaw: marker.raw,
        prevMarkerRaw: prev.raw,
        ruleCode: 'NON_SEQUENTIAL_INDEX',
      } satisfies NewsMarkerMetric)
    }

    if (marker.time! <= prev.time!) {
      metrics.push({
        type: 'NEWS_MARKER',
        lineIndex: marker.lineIndex,
        blockType,
        markerRaw: marker.raw,
        prevMarkerRaw: prev.raw,
        ruleCode: 'NON_INCREASING_TIME',
      } satisfies NewsMarkerMetric)
    }

    return metrics
  }) as SegmentRule
}
