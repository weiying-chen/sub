#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

import { parseInspectArgs } from './inspectArgs'
import { buildInspectOutput } from './inspectOutput'

function printUsage() {
  console.error(
    'Usage: inspect <file>|--text/-t "..." [--type subs|news] [--segment N] [--ignore-empty-lines] [--compact]'
  )
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

const args = parseInspectArgs(process.argv.slice(2))

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

const output = buildInspectOutput(text, {
  type: args.type,
  segmentIndex: args.segmentIndex,
  ignoreEmptyLines: args.ignoreEmptyLines,
})

console.log(JSON.stringify(output, null, args.compact ? 0 : 2))
