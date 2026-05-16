export type SharedCliFlags = {
  type: string
  includeWarnings: boolean
  ignoreEmptyLines: boolean
  ruleFilters: string[]
  maxCps: number | null
  consumedIndexes: Set<number>
}

export function parseSharedCliFlags(args: string[]): SharedCliFlags {
  let type = 'subs'
  let includeWarnings = true
  let ignoreEmptyLines = false
  let maxCps: number | null = null
  const ruleFilters: string[] = []
  const consumedIndexes = new Set<number>()

  for (let i = 0; i < args.length; i += 1) {
    if (consumedIndexes.has(i)) continue
    const arg = args[i]

    if (arg === '--no-warn') {
      includeWarnings = false
      consumedIndexes.add(i)
      continue
    }

    if (arg === '--ignore-empty-lines') {
      ignoreEmptyLines = true
      consumedIndexes.add(i)
      continue
    }

    if (arg === '--type' && i + 1 < args.length) {
      type = args[i + 1]
      consumedIndexes.add(i)
      consumedIndexes.add(i + 1)
      i += 1
      continue
    }

    if (arg.startsWith('--type=')) {
      type = arg.slice('--type='.length)
      consumedIndexes.add(i)
      continue
    }

    if (arg === '--rule' && i + 1 < args.length) {
      ruleFilters.push(args[i + 1])
      consumedIndexes.add(i)
      consumedIndexes.add(i + 1)
      i += 1
      continue
    }

    if (arg.startsWith('--rule=')) {
      ruleFilters.push(arg.slice('--rule='.length))
      consumedIndexes.add(i)
      continue
    }

    if (arg === '--max-cps' && i + 1 < args.length) {
      const parsed = Number(args[i + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        maxCps = parsed
      }
      consumedIndexes.add(i)
      consumedIndexes.add(i + 1)
      i += 1
      continue
    }

    if (arg.startsWith('--max-cps=')) {
      const parsed = Number(arg.slice('--max-cps='.length))
      if (Number.isFinite(parsed) && parsed > 0) {
        maxCps = parsed
      }
      consumedIndexes.add(i)
      continue
    }
  }

  return {
    type,
    includeWarnings,
    ignoreEmptyLines,
    ruleFilters,
    maxCps,
    consumedIndexes,
  }
}
