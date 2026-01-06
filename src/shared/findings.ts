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
        out.push({ ...m, type: 'MAX_CPS' })
        continue
      }
      if (m.cps < m.minCps) {
        out.push({ ...m, type: 'MIN_CPS' })
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
