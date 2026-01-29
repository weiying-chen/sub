import { readFile } from 'node:fs/promises'

import { parseMetricsArgs } from './metricsArgs'
import { buildMetricsOutput } from './metricsCore'

function printUsage() {
  console.error(
    'Usage: metrics <file>|--text/-t "..." [--type subs|news] [--rule NAME] [--findings] [--ignore-empty-lines]'
  )
}

const args = parseMetricsArgs(process.argv.slice(2))

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

if (args.type !== 'subs' && args.type !== 'news') {
  printUsage()
  process.exit(1)
}

if (args.unknownFlags.length > 0) {
  printUsage()
  process.exit(1)
}

if (!args.filePath && !args.textArg && process.stdin.isTTY) {
  printUsage()
  process.exit(1)
}

const text = args.textArg
  ? args.textArg
  : args.filePath
  ? await readFile(args.filePath, 'utf8')
  : await readStdin()

if (!text.trim() && !args.filePath && !args.textArg) {
  printUsage()
  process.exit(1)
}

const output = await buildMetricsOutput(text, {
  type: args.type,
  ruleFilters: args.ruleFilters,
  findingsOnly: args.findingsOnly,
  ignoreEmptyLines: args.ignoreEmptyLines,
})

console.log(JSON.stringify(output, null, 2))
