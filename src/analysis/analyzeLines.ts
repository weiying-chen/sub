import type { Rule, Metric } from './types'

export function analyzeLines(text: string, rules: Rule[]): Metric[] {
  const lines = text.split('\n')
  const metrics: Metric[] = []

  const getLine = (index: number) => lines[index]

  lines.forEach((line, lineIndex) => {
    const ctx = {
      line,
      lineIndex,
      lines,
      getLine,
    }

    for (const rule of rules) {
      metrics.push(...rule(ctx))
    }
  })

  return metrics
}
