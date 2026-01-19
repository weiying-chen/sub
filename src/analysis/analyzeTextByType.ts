import type { Metric } from './types'
import type { SegmentRule } from './segments'

import { analyzeSegments, parseNews, parseSubs } from './segments'
import { normalizeLineEndings } from '../shared/normalizeLineEndings'
import type { ParseBlockOptions } from '../shared/tsvRuns'

export type AnalysisType = 'subs' | 'news'

export function analyzeTextByType(
  text: string,
  type: AnalysisType,
  rules: SegmentRule[],
  options: { parseOptions?: ParseBlockOptions } = {}
): Metric[] {
  const normalizedText = normalizeLineEndings(text)
  const lines = normalizedText.split('\n')
  const parsed =
    type === 'news'
      ? parseNews(normalizedText)
      : parseSubs(normalizedText, options.parseOptions)
  const segments =
    parsed.length > 0 ? parsed : [{ lineIndex: 0, text: '' }]
  return analyzeSegments(segments, rules, {
    lines,
    sourceText: normalizedText,
  })
}
