export type FillSubsCliArgs = {
  inputFile: string
  outputFile: string
  inline: boolean
  paragraphArg: string
}

export function parseFillSubsArgs(argv: string[]): FillSubsCliArgs {
  const args: FillSubsCliArgs = {
    inputFile: '',
    outputFile: '',
    inline: true,
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
    if (a === '--inline') {
      args.inline = true
      continue
    }
    if (a === '--no-inline') {
      args.inline = false
      continue
    }
    if (a === '-p' || a === '--paragraph') {
      args.paragraphArg = argv[i + 1] ?? ''
      i++
      continue
    }
  }

  return args
}
