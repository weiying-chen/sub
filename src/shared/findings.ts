import type { Metric, Finding } from '../analysis/types'

export function getFindings(metrics: Metric[]): Finding[] {
  const out: Finding[] = []

  for (const m of metrics) {
    if (m.type === 'MAX_CHARS') {
      if (m.actual > m.maxAllowed) out.push(m)
      continue
    }

    if (m.type === 'CPS') {
      if (m.cps > m.maxCps) {
        out.push({
          type: 'MAX_CPS',
          lineIndex: m.lineIndex,
          text: m.text,
          cps: m.cps,
          maxCps: m.maxCps,
          durationFrames: m.durationFrames,
          charCount: m.charCount,
          severity: 'error',
        })
        continue
      }
      if (m.cps < m.minCps) {
        out.push({
          type: 'MIN_CPS',
          lineIndex: m.lineIndex,
          text: m.text,
          cps: m.cps,
          minCps: m.minCps,
          durationFrames: m.durationFrames,
          charCount: m.charCount,
          severity: 'warn',
        })
      }
      continue
    }

    if (m.type === 'CPS_BALANCE') {
      out.push(m) // warn (yellow later)
      continue
    }

    if (m.type === 'NUMBER_STYLE') {
      out.push(m)
      continue
    }

    if (m.type === 'PUNCTUATION') {
      out.push(m)
      continue
    }

    if (m.type === 'BASELINE') {
      out.push(m)
      continue
    }
  }

  return out
}
