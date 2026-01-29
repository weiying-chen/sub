export type MetricsArgs = {
  filePath: string | null
  textArg: string
  type: 'subs' | 'news' | string
  ruleFilters: string[]
  findingsOnly: boolean
  ignoreEmptyLines: boolean
  unknownFlags: string[]
}

export function parseMetricsArgs(args: string[]): MetricsArgs {
  let filePath: string | null = null
  let textArg = ''
  let type: 'subs' | 'news' | string = 'subs'
  const ruleFilters: string[] = []
  let findingsOnly = false
  let ignoreEmptyLines = false
  const unknownFlags: string[] = []

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]

    if (arg === '--type' && i + 1 < args.length) {
      type = args[i + 1] as 'subs' | 'news'
      i += 1
      continue
    }

    if (arg.startsWith('--type=')) {
      type = arg.slice('--type='.length) as 'subs' | 'news'
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

    if (arg === '--rule' && i + 1 < args.length) {
      ruleFilters.push(args[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--rule=')) {
      ruleFilters.push(arg.slice('--rule='.length))
      continue
    }

    if (arg === '--findings') {
      findingsOnly = true
      continue
    }

    if (arg === '--ignore-empty-lines') {
      ignoreEmptyLines = true
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
    type,
    ruleFilters,
    findingsOnly,
    ignoreEmptyLines,
    unknownFlags,
  }
}
