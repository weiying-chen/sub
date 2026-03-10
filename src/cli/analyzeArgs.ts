import { parseSharedCliFlags } from './sharedArgs'

export type AnalyzeArgs = {
  filePath: string | null
  textArg: string
  type: 'subs' | 'news' | string
  includeWarnings: boolean
  mode: 'metrics' | 'findings' | string
  ruleFilters: string[]
  baselinePath: string | null
  ignoreEmptyLines: boolean
  unknownFlags: string[]
}

export function parseAnalyzeArgs(args: string[]): AnalyzeArgs {
  let filePath: string | null = null
  let textArg = ''
  const shared = parseSharedCliFlags(args)
  let mode: 'metrics' | 'findings' | string = 'metrics'
  let baselinePath: string | null = null
  const unknownFlags: string[] = []

  for (let i = 0; i < args.length; i += 1) {
    if (shared.consumedIndexes.has(i)) continue
    const arg = args[i]

    if (arg === '--mode' && i + 1 < args.length) {
      mode = args[i + 1] as 'metrics' | 'findings'
      i += 1
      continue
    }

    if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length) as 'metrics' | 'findings'
      continue
    }

    if ((arg === '--text' || arg === '-t') && i + 1 < args.length) {
      textArg = args[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--text=')) {
      textArg = arg.slice('--text='.length)
      continue
    }

    if (arg === '--baseline' && i + 1 < args.length) {
      baselinePath = args[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--baseline=')) {
      baselinePath = arg.slice('--baseline='.length)
      continue
    }

    if (arg.startsWith('-')) {
      unknownFlags.push(arg)
      continue
    }

    if (!filePath) {
      filePath = arg
      continue
    }
  }

  return {
    filePath,
    textArg,
    type: shared.type,
    includeWarnings: shared.includeWarnings,
    mode,
    ruleFilters: shared.ruleFilters,
    baselinePath,
    ignoreEmptyLines: shared.ignoreEmptyLines,
    unknownFlags,
  }
}
