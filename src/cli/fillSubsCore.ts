export type FillSubsCliArgs = {
  inputFile: string
  outputFile: string
  altBreak: boolean
  paragraphArg: string
  maxChars?: number
  showOverflow?: boolean
  overflowToClipboard?: boolean
  paragraphFile?: string
  clipboardTimeoutMs?: number
}

export function parseFillSubsArgs(argv: string[]): FillSubsCliArgs {
  const args: FillSubsCliArgs = {
    inputFile: '',
    outputFile: '',
    altBreak: false,
    paragraphArg: '',
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-i' || a === '--in') {
      args.inputFile = argv[i + 1] ?? ''
      i++
      continue
    }
    if (a === '-o' || a === '--out') {
      args.outputFile = argv[i + 1] ?? ''
      i++
      continue
    }
    if (a === '--alt-break') {
      args.altBreak = true
      continue
    }
    if (a === '--max-chars') {
      const value = Number(argv[i + 1] ?? '')
      if (Number.isFinite(value)) {
        args.maxChars = value
      }
      i++
      continue
    }
    if (a.startsWith('--max-chars=')) {
      const value = Number(a.slice('--max-chars='.length))
      if (Number.isFinite(value)) {
        args.maxChars = value
      }
      continue
    }
    if (a === '--show-overflow') {
      args.showOverflow = true
      continue
    }
    if (a === '--no-show-overflow') {
      args.showOverflow = false
      continue
    }
    if (a === '--overflow-to-clipboard') {
      args.overflowToClipboard = true
      continue
    }
    if (a === '--no-overflow-to-clipboard') {
      args.overflowToClipboard = false
      continue
    }
    if (a === '--paragraph-file') {
      args.paragraphFile = argv[i + 1] ?? ''
      i++
      continue
    }
    if (a.startsWith('--paragraph-file=')) {
      args.paragraphFile = a.slice('--paragraph-file='.length)
      continue
    }
    if (a === '--clipboard-timeout-ms') {
      const value = Number(argv[i + 1] ?? '')
      if (Number.isFinite(value) && value > 0) {
        args.clipboardTimeoutMs = value
      }
      i++
      continue
    }
    if (a.startsWith('--clipboard-timeout-ms=')) {
      const value = Number(a.slice('--clipboard-timeout-ms='.length))
      if (Number.isFinite(value) && value > 0) {
        args.clipboardTimeoutMs = value
      }
      continue
    }
    if (a === '-t' || a === '--text') {
      args.paragraphArg = argv[i + 1] ?? ''
      i++
      continue
    }
  }

  return args
}
