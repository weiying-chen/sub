import type { Metric } from './types'
import type { SegmentRule } from './segments'

import { analyzeSegments, parseNews, parseSubs } from './segments'

export type AnalysisType = 'subs' | 'news'

export function analyzeTextByType(
  text: string,
  type: AnalysisType,
  rules: SegmentRule[]
): Metric[] {
  const lines = text.split('\n')
  const parsed = type === 'news' ? parseNews(text) : parseSubs(text)
  const segments =
    parsed.length > 0 ? parsed : [{ lineIndex: 0, text: '' }]
  return analyzeSegments(segments, rules, { lines, sourceText: text })
}
