export type InspectArgs = {
  filePath: string | null
  textArg: string
  type: 'subs' | 'news' | string
  segmentIndex: number | null
  compact: boolean
  ignoreEmptyLines: boolean
  unknownFlags: string[]
}

export function parseInspectArgs(args: string[]): InspectArgs {
  let filePath: string | null = null
  let textArg = ''
  let type: 'subs' | 'news' | string = 'subs'
  let segmentIndex: number | null = null
  let compact = false
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

    if (arg === '--segment' && i + 1 < args.length) {
      const value = Number.parseInt(args[i + 1], 10)
      segmentIndex = Number.isInteger(value) ? value : null
      i += 1
      continue
    }

    if (arg.startsWith('--segment=')) {
      const value = Number.parseInt(arg.slice('--segment='.length), 10)
      segmentIndex = Number.isInteger(value) ? value : null
      continue
    }

    if (arg === '--compact') {
      compact = true
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
    }
  }

  return {
    filePath,
    textArg,
    type,
    segmentIndex,
    compact,
    ignoreEmptyLines,
    unknownFlags,
  }
}
