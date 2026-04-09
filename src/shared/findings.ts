import type { Metric, Finding } from '../analysis/types'
import { TIMESTAMP_FORMAT_FINDING_INSTRUCTION } from './wording'

type FindingsOptions = {
  includeWarnings?: boolean
}

export function getFindings(
  metrics: Metric[],
  options: FindingsOptions = {}
): Finding[] {
  const includeWarnings = options.includeWarnings ?? true
  const out: Finding[] = []

  for (const m of metrics) {
    if (m.type === 'MAX_CHARS') {
      if (m.actual > m.maxAllowed) {
        out.push({
          ...m,
          severity: 'error',
          instruction: `Shorten this translation to ${m.maxAllowed} characters or fewer.`,
        })
      }
      continue
    }

    if (m.type === 'LEADING_WHITESPACE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: 'Remove leading spaces at the start of this translation.',
      })
      continue
    }

    if (m.type === 'BLOCK_STRUCTURE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: 'Add the missing translation below these timestamps.',
      })
      continue
    }

    if (m.type === 'TIMESTAMP_FORMAT') {
      out.push({
        ...m,
        severity: 'error',
        instruction:
          TIMESTAMP_FORMAT_FINDING_INSTRUCTION,
      })
      continue
    }

    if (m.type === 'CPS') {
      if (m.cps > m.maxCps) {
        out.push({
          type: 'MAX_CPS',
          lineIndex: m.lineIndex,
          tsLineIndex: m.tsLineIndex,
          text: m.text,
          cps: m.cps,
          maxCps: m.maxCps,
          durationFrames: m.durationFrames,
          charCount: m.charCount,
          severity: 'error',
          instruction: `Reduce reading speed to ${m.maxCps} CPS or less.`,
        })
        continue
      }
      if (m.cps < m.minCps) {
        out.push({
          type: 'MIN_CPS',
          lineIndex: m.lineIndex,
          tsLineIndex: m.tsLineIndex,
          text: m.text,
          cps: m.cps,
          minCps: m.minCps,
          durationFrames: m.durationFrames,
          charCount: m.charCount,
          severity: 'warn',
          instruction: `Increase reading speed to at least ${m.minCps} CPS.`,
        })
      }
      continue
    }

    if (m.type === 'MAX_CPS') {
      out.push({
        ...m,
        severity: 'error',
        instruction: `Reduce reading speed to ${m.maxCps} CPS or less.`,
      })
      continue
    }

    if (m.type === 'MIN_CPS') {
      out.push({
        ...m,
        severity: 'warn',
        instruction: `Increase reading speed to at least ${m.minCps} CPS.`,
      })
      continue
    }

    if (m.type === 'CPS_BALANCE') {
      out.push({
        ...m,
        severity: 'warn',
        instruction:
          'Keep adjacent reading speeds closer to each other for smoother pacing.',
      })
      continue
    }

    if (m.type === 'MERGE_CANDIDATE') {
      out.push({
        ...m,
        severity: 'warn',
        instruction:
          'These adjacent translations are very similar and close in time; consider merging them into one timestamp span.',
      })
      continue
    }

    if (m.type === 'SPAN_GAP') {
      out.push({
        ...m,
        severity: 'warn',
        instruction:
          'This translation disappears and reappears after a timing gap. Split or rewrite it instead of spanning across it.',
      })
      continue
    }

    if (m.type === 'NUMBER_STYLE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: m.ruleCode === 'DECADE_WORD_AS_TEXT'
          ? `Use ${m.value}s instead of the word "${m.token}".`
          : m.expected === 'words'
            ? 'Use words instead of digits for this number.'
            : 'Use digits instead of words for this number.',
      })
      continue
    }

    if (m.type === 'PERCENT_STYLE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: 'Use the percent symbol (%) instead of the word "percent".',
      })
      continue
    }

    if (m.type === 'CAPITALIZATION') {
      out.push({
        ...m,
        severity: 'error',
        instruction: `Use "${m.expected}" capitalization.`,
      })
      continue
    }

    if (m.type === 'DASH_STYLE') {
      const expected =
        m.expected === 'em_dash' ? 'an em dash (—)' : 'triple hyphens (---)'
      out.push({
        ...m,
        severity: 'error',
        instruction: `Use ${expected} for this text type.`,
      })
      continue
    }

    if (m.type === 'PUNCTUATION') {
      const instruction =
        m.ruleCode === 'LOWERCASE_AFTER_PERIOD'
          ? 'Capitalize the start of this translation.'
          : m.ruleCode === 'MISSING_PUNCTUATION_BEFORE_CAPITAL'
            ? 'End this translation with sentence-ending punctuation, or lowercase the next translation.'
            : m.ruleCode === 'COMMA_BEFORE_QUOTE'
              ? "End this translation with ':' before the next quoted translation."
              : m.ruleCode === 'MISSING_END_PUNCTUATION'
                ? "End this translation with terminal punctuation (., ?, !, :, …, —, or '...')."
                : m.ruleCode === 'MISSING_CLOSING_QUOTE'
                  ? 'Add a closing " to match the opening quote.'
                  : 'Remove the extra closing " or add a matching opening ".'
      out.push({ ...m, severity: 'error', instruction })
      continue
    }

    if (m.type === 'BASELINE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: m.message,
      })
      continue
    }

    if (m.type === 'MISSING_TRANSLATION') {
      out.push({
        ...m,
        severity: 'error',
        instruction:
          m.blockType === 'super'
            ? 'Translate this SUPER block.'
            : 'Translate this VO block.',
      })
      continue
    }

    if (m.type === 'NEWS_MARKER') {
      const instruction =
        m.ruleCode === 'INVALID_FORMAT'
          ? 'Use the marker format N_0000.'
          : m.ruleCode === 'NON_SEQUENTIAL_INDEX'
            ? 'Keep marker numbers increasing by exactly one.'
            : 'Keep marker time values increasing from one block to the next.'

      out.push({
        ...m,
        severity: 'error',
        instruction,
      })
      continue
    }

    if (m.type === 'SUPER_PEOPLE') {
      const instruction =
        m.ruleCode === 'NAME_TITLE_ORDER'
          ? 'Keep the English name on line 2 and the English title on line 3.'
          : m.ruleCode === 'TITLE_NOT_SENTENCE_CASE'
            ? 'Use sentence case for the English title.'
            : m.ruleCode === 'MISSING_EN_NAME'
              ? 'Add the English name on line 2.'
              : 'Add the English title on line 3.'

      out.push({
        ...m,
        severity: 'error',
        instruction,
      })
      continue
    }
  }

  if (includeWarnings) return out
  return out.filter(
    (finding) => !('severity' in finding) || finding.severity !== 'warn'
  )
}
