import type { Metric, Finding } from '../analysis/types'

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
          instruction: `Shorten this line to ${m.maxAllowed} characters or fewer.`,
        })
      }
      continue
    }

    if (m.type === 'LEADING_WHITESPACE') {
      out.push({
        ...m,
        severity: 'error',
        instruction: 'Remove leading spaces at the start of this line.',
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
          instruction: `Reduce reading speed to ${m.maxCps} CPS or lower.`,
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
        instruction: `Reduce reading speed to ${m.maxCps} CPS or lower.`,
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
      out.push({ ...m, severity: 'warn', instruction: m.instruction })
      continue
    }

    if (m.type === 'NUMBER_STYLE') {
      out.push({
        ...m,
        severity: 'error',
        instruction:
          m.expected === 'words'
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

    if (m.type === 'PUNCTUATION') {
      out.push({ ...m, severity: 'error', instruction: m.instruction })
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
  }

  if (includeWarnings) return out
  return out.filter(
    (finding) => !('severity' in finding) || finding.severity !== 'warn'
  )
}
