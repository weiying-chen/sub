import type { Rule, Finding } from './types'

export function analyzeLines(text: string, rules: Rule[]): Finding[] {
  const lines = text.split('\n')
  const findings: Finding[] = []

  const getLine = (index: number) => lines[index]

  lines.forEach((line, lineIndex) => {
    const ctx = {
      line,
      lineIndex,
      lines,
      getLine,
    }

    for (const rule of rules) {
      findings.push(...rule(ctx))
    }
  })

  return findings
}
