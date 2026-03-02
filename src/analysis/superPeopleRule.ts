import type { SegmentCtx, SegmentRule } from './segments'
import type { Metric } from './types'

export type SuperPeopleRuleCode =
  | 'NAME_TITLE_ORDER'
  | 'TITLE_NOT_SENTENCE_CASE'
  | 'MISSING_EN_NAME'
  | 'MISSING_EN_TITLE'

export type SuperPeopleMetric = {
  type: 'SUPER_PEOPLE'
  lineIndex: number
  ruleCode: SuperPeopleRuleCode
  text: string
  severity?: 'error' | 'warn'
}

function getWordTokens(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z.'-]*/g) ?? []
}

function looksLikeName(text: string): boolean {
  const words = getWordTokens(text)
  if (words.length === 0 || words.length > 4) return false

  return words.every(
    (word) =>
      /^[A-Z][a-z.'-]*$/.test(word) ||
      /^[A-Z]{2,}$/.test(word) ||
      /^(?:Dr|Mr|Mrs|Ms)\.?$/.test(word)
  )
}

function isSentenceCase(text: string): boolean {
  const words = getWordTokens(text)
  if (words.length === 0) return true
  if (!/^[A-Z]/.test(words[0]!)) return false

  return words.slice(1).every((word) => !/^[A-Z][a-z]/.test(word))
}

export function superPeopleRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const { segment } = ctx
    if (segment.blockType !== 'super_people' || !segment.superPerson) return []

    const metrics: Metric[] = []
    const { enName, enTitle } = segment.superPerson
    const entryLines = segment.targetLines ?? []
    const enNameLineIndex = entryLines[1]?.lineIndex ?? segment.lineIndex
    const enTitleLineIndex = entryLines[2]?.lineIndex ?? enNameLineIndex

    if (!enName) {
      metrics.push({
        type: 'SUPER_PEOPLE',
        lineIndex: enNameLineIndex,
        ruleCode: 'MISSING_EN_NAME',
        text: '',
      } satisfies SuperPeopleMetric)
    }

    if (!enTitle) {
      metrics.push({
        type: 'SUPER_PEOPLE',
        lineIndex: enTitleLineIndex,
        ruleCode: 'MISSING_EN_TITLE',
        text: '',
      } satisfies SuperPeopleMetric)
    }

    if (!enName || !enTitle) return metrics

    const hasSwappedNameTitle = !looksLikeName(enName) && looksLikeName(enTitle)

    if (hasSwappedNameTitle) {
      metrics.push({
        type: 'SUPER_PEOPLE',
        lineIndex: enNameLineIndex,
        ruleCode: 'NAME_TITLE_ORDER',
        text: enName,
      } satisfies SuperPeopleMetric)
    }

    if (!hasSwappedNameTitle && enTitle && !isSentenceCase(enTitle)) {
      metrics.push({
        type: 'SUPER_PEOPLE',
        lineIndex: enTitleLineIndex,
        ruleCode: 'TITLE_NOT_SENTENCE_CASE',
        text: enTitle,
      } satisfies SuperPeopleMetric)
    }

    return metrics
  }) as SegmentRule
}
