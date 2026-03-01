import type { MissingTranslationMetric } from './types'
import type { SegmentCtx, SegmentRule } from './segments'

export function missingTranslationRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const blockType = ctx.segment.blockType
    if (blockType !== 'vo' && blockType !== 'super') return []

    const sourceText = ctx.segment.sourceText?.trim() ?? ''
    if (sourceText === '') return []

    const targetCount = ctx.segment.targetLines?.length ?? 0
    if (targetCount > 0) return []

    const metric: MissingTranslationMetric = {
      type: 'MISSING_TRANSLATION',
      lineIndex: ctx.segment.lineIndex,
      blockType,
      text: sourceText,
      sourceLineIndex: ctx.segment.sourceLines?.[0]?.lineIndex,
    }

    return [metric]
  }) as SegmentRule
}
