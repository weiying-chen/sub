import type { SegmentCtx, SegmentRule } from './segments'
import type { Metric } from './types'

export type SuperPeopleRuleCode =
  | 'NAME_TITLE_ORDER'
  | 'TITLE_NOT_SENTENCE_CASE'
  | 'MISSING_EN_NAME'
  | 'MISSING_EN_TITLE'

export type SuperPeopleMetric = {
  type: 'PEOPLE'
  lineIndex: number
  ruleCode: SuperPeopleRuleCode
  text: string
  severity?: 'error' | 'warn'
}

function getWordTokens(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z.'-]*/g) ?? []
}

const ALLOWED_TITLE_PROPER_NOUN_PHRASES = [['Tzu', 'Chi']]

function looksLikeName(text: string): boolean {
  const words = getWordTokens(text)
  if (words.length < 2 || words.length > 4) return false

  return words.every(
    (word) =>
      /^[A-Z][a-z.'-]*$/.test(word) ||
      /^[A-Z]{2,}$/.test(word) ||
      /^(?:Dr|Mr|Mrs|Ms)\.?$/.test(word)
  )
}

function isSentenceCase(text: string): boolean {
  const normalizedText = text.trim().replace(/\s+/g, ' ')
  const words = getWordTokens(normalizedText)
  if (words.length === 0) return true
  if (!/^[A-Z]/.test(words[0]!)) return false

  const allowsProperNounPhrase = ALLOWED_TITLE_PROPER_NOUN_PHRASES.find((phrase) => {
    if (words.length < phrase.length) return false
    return phrase.every((token, index) => words[index]?.toLowerCase() === token.toLowerCase())
  })

  if (allowsProperNounPhrase) {
    return words
      .slice(allowsProperNounPhrase.length)
      .every((word) => !/^[A-Z][a-z]/.test(word))
  }

  return words.slice(1).every((word) => !/^[A-Z][a-z]/.test(word))
}

export function superPeopleRule(): SegmentRule {
  return ((ctx: SegmentCtx) => {
    const { segment } = ctx
    if (segment.blockType !== 'people' || !segment.superPerson) return []

    const metrics: Metric[] = []
    const { enName, enTitle } = segment.superPerson
    const entryLines = segment.targetLines ?? []
    const enNameLineIndex = entryLines[1]?.lineIndex ?? segment.lineIndex
    const enTitleLineIndex = entryLines[2]?.lineIndex ?? enNameLineIndex

    if (!enName) {
      metrics.push({
        type: 'PEOPLE',
        lineIndex: enNameLineIndex,
        ruleCode: 'MISSING_EN_NAME',
        text: '',
      } satisfies SuperPeopleMetric)
    }

    if (!enTitle) {
      metrics.push({
        type: 'PEOPLE',
        lineIndex: enTitleLineIndex,
        ruleCode: 'MISSING_EN_TITLE',
        text: '',
      } satisfies SuperPeopleMetric)
    }

    if (!enName || !enTitle) return metrics

    const hasSwappedNameTitle = !looksLikeName(enName) && looksLikeName(enTitle)

    if (hasSwappedNameTitle) {
      metrics.push({
        type: 'PEOPLE',
        lineIndex: enNameLineIndex,
        ruleCode: 'NAME_TITLE_ORDER',
        text: enName,
      } satisfies SuperPeopleMetric)
    }

    if (!hasSwappedNameTitle && enTitle && !isSentenceCase(enTitle)) {
      metrics.push({
        type: 'PEOPLE',
        lineIndex: enTitleLineIndex,
        ruleCode: 'TITLE_NOT_SENTENCE_CASE',
        text: enTitle,
      } satisfies SuperPeopleMetric)
    }

    return metrics
  }) as SegmentRule
}
