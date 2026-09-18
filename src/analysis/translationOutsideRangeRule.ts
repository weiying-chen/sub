import type { TranslationOutsideRangeMetric } from './types'
import type { SegmentCtx, SegmentRule } from './segments'

export function translationOutsideRangeRule(): SegmentRule {
  return (ctx: SegmentCtx) => {
    if (!ctx.segment.skipTranslation) return []
    const targetLine = ctx.segment.targetLines?.[0]
    if (!targetLine) return []

    const metric: TranslationOutsideRangeMetric = {
      type: 'TRANSLATION_OUTSIDE_RANGE',
      lineIndex: targetLine.lineIndex,
      text: ctx.segment.targetLines?.map((line) => line.lineText).join(' ') ?? '',
      severity: 'warn',
    }
    return [metric]
  }
}
