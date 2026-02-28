import { readFile } from 'node:fs/promises'

import { parseAnalyzeArgs } from './analyzeArgs'
import { buildAnalyzeOutput } from './analyzeOutput'

function printUsage() {
  console.error(
    'Usage: analyze <file>|--text/-t "..." [--type subs|news] [--mode metrics|findings] [--rule NAME] [--ignore-empty-lines]'
  )
}

const args = parseAnalyzeArgs(process.argv.slice(2))

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

if (args.mode !== 'metrics' && args.mode !== 'findings') {
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

const output = await buildAnalyzeOutput(text, {
  type: args.type,
  mode: args.mode,
  ruleFilters: args.ruleFilters,
  ignoreEmptyLines: args.ignoreEmptyLines,
})

console.log(JSON.stringify(output, null, 2))
