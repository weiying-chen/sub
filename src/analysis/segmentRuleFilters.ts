import type { Segment, SegmentCtx, SegmentRule } from './segments'

export function filterSegments(
  predicate: (segment: Segment, ctx: SegmentCtx) => boolean,
  rule: SegmentRule
): SegmentRule {
  return (ctx) => (predicate(ctx.segment, ctx) ? rule(ctx) : [])
}
