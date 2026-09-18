import type { Metric } from './types'
import type { SegmentRule } from './segments'

import { analyzeSegments, parseDocs, parseNews, parseSubs, parseText } from './segments'
import { normalizeLineEndings } from '../shared/normalizeLineEndings'
import type { ParseBlockOptions } from '../shared/tsvRuns'

export type AnalysisType = 'subs' | 'news' | 'text' | 'docs'

export function analyzeTextByType(
  text: string,
  type: AnalysisType,
  rules: SegmentRule[],
  options: { parseOptions?: ParseBlockOptions; baselineText?: string } = {}
): Metric[] {
  const normalizedText = normalizeLineEndings(text)
  const lines = normalizedText.split('\n')
  const parsed =
    type === 'news'
      ? parseNews(normalizedText)
      : type === 'docs'
        ? parseDocs(normalizedText, options.baselineText)
      : type === 'text'
        ? parseText(normalizedText)
        : parseSubs(normalizedText, options.parseOptions)
  const segments =
    parsed.length > 0 ? parsed : [{ lineIndex: 0, translation: '' }]
  return analyzeSegments(segments, rules, {
    lines,
    sourceText: normalizedText,
  })
}
