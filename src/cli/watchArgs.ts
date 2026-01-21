type WatchArgs = {
  filePath?: string
  type: string
  showWarnings: boolean
  baselinePath: string | null
  ignoreEmptyLines: boolean
}

export function parseArgs(argv: string[]): WatchArgs {
  const positionals: string[] = []
  let type = 'subs'
  let showWarnings = true
  let baselinePath: string | null = null
  let ignoreEmptyLines = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--no-warn') {
      showWarnings = false
      continue
    }

    if (arg === '--baseline') {
      const next = argv[i + 1]
      if (next) {
        baselinePath = next
        i += 1
        continue
      }
    }

    if (arg === '--ignore-empty-lines') {
      ignoreEmptyLines = true
      continue
    }

    if (arg === '--type') {
      const next = argv[i + 1]
      if (next) {
        type = next
        i += 1
        continue
      }
    }

    if (arg.startsWith('--type=')) {
      type = arg.slice('--type='.length)
      continue
    }

    if (arg.startsWith('--baseline=')) {
      baselinePath = arg.slice('--baseline='.length)
      continue
    }

    if (arg.startsWith('-')) continue
    positionals.push(arg)
  }

  return { filePath: positionals[0], type, showWarnings, baselinePath, ignoreEmptyLines }
}
