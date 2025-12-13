import type { Rule, Violation } from './types'

export function analyzeLines(
  text: string,
  rules: Rule[]
): Violation[] {
  const lines = text.split('\n')
  const violations: Violation[] = []

  lines.forEach((line, lineIndex) => {
    for (const rule of rules) {
      violations.push(...rule({ line, lineIndex }))
    }
  })

  return violations
}
