import { parseSharedCliFlags } from './sharedArgs'
import type { Metric } from '../analysis/types'

type WatchArgs = {
  filePath?: string
  type: string
  includeWarnings: boolean
  ruleFilters: Metric['type'][]
  baselinePath: string | null
  ignoreEmptyLines: boolean
}

export function parseArgs(argv: string[]): WatchArgs {
  const positionals: string[] = []
  const shared = parseSharedCliFlags(argv)
  let baselinePath: string | null = null

  for (let i = 0; i < argv.length; i += 1) {
    if (shared.consumedIndexes.has(i)) continue
    const arg = argv[i]

    if (arg === '--baseline') {
      const next = argv[i + 1]
      if (next) {
        baselinePath = next
        i += 1
        continue
      }
    }

    if (arg.startsWith('--baseline=')) {
      baselinePath = arg.slice('--baseline='.length)
      continue
    }

    if (arg.startsWith('-')) continue
    positionals.push(arg)
  }

  return {
    filePath: positionals[0],
    type: shared.type,
    includeWarnings: shared.includeWarnings,
    ruleFilters: shared.ruleFilters as Metric['type'][],
    baselinePath,
    ignoreEmptyLines: shared.ignoreEmptyLines,
  }
}
