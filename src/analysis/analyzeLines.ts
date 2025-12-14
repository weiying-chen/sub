import type { Rule, Violation } from './types'

export function analyzeLines(text: string, rules: Rule[]): Violation[] {
  const lines = text.split('\n')
  const violations: Violation[] = []

  const getLine = (index: number) => lines[index]

  lines.forEach((line, lineIndex) => {
    const ctx = {
      line,
      lineIndex,
      lines,
      getLine,
    }

    for (const rule of rules) {
      violations.push(...rule(ctx))
    }
  })

  return violations
}
