import { readFile } from 'node:fs/promises'

import { buildMetricsOutput } from './metricsCore'

type MetricsArgs = {
  filePath: string | null
  type: 'subs' | 'news'
  ruleFilters: string[]
  findingsOnly: boolean
  ignoreEmptyLines: boolean
}

function printUsage() {
  console.error(
    'Usage: metrics <file> [--type subs|news] [--rule NAME] [--findings] [--ignore-empty-lines]'
  )
}

function parseArgs(args: string[]): MetricsArgs {
  let filePath: string | null = null
  let type: 'subs' | 'news' = 'subs'
  const ruleFilters: string[] = []
  let findingsOnly = false
  let ignoreEmptyLines = false

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
      printUsage()
      process.exit(1)
    }

    if (!filePath) {
      filePath = arg
      continue
    }
  }

  if (type !== 'subs' && type !== 'news') {
    printUsage()
    process.exit(1)
  }

  return { filePath, type, ruleFilters, findingsOnly, ignoreEmptyLines }
}

const args = parseArgs(process.argv.slice(2))

if (!args.filePath) {
  printUsage()
  process.exit(1)
}

const text = await readFile(args.filePath, 'utf8')
const output = await buildMetricsOutput(text, {
  type: args.type,
  ruleFilters: args.ruleFilters,
  findingsOnly: args.findingsOnly,
  ignoreEmptyLines: args.ignoreEmptyLines,
})

console.log(JSON.stringify(output, null, 2))
