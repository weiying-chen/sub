import { readFile } from 'node:fs/promises'

import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { capitalizationRule } from '../analysis/capitalizationRule'
import { defaultSegmentRules } from '../analysis/defaultRules'
import { maxCharsRule } from '../analysis/maxCharsRule'
import { numberStyleRule } from '../analysis/numberStyleRule'
import { punctuationRuleWithOptions } from '../analysis/punctuationRule'
import type { Metric } from '../analysis/types'
import { getFindings } from '../shared/findings'

type MetricsArgs = {
  filePath: string | null
  type: 'subs' | 'news'
  ruleFilters: string[]
  findingsOnly: boolean
}

const PROPER_NOUNS_PATH = 'punctuation-proper-nouns.txt'

function printUsage() {
  console.error(
    'Usage: metrics <file> [--type subs|news] [--rule NAME] [--findings]'
  )
}

function parseArgs(args: string[]): MetricsArgs {
  let filePath: string | null = null
  let type: 'subs' | 'news' = 'subs'
  const ruleFilters: string[] = []
  let findingsOnly = false

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

  return { filePath, type, ruleFilters, findingsOnly }
}

async function loadProperNouns() {
  try {
    const raw = await readFile(PROPER_NOUNS_PATH, 'utf8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
  } catch {
    return null
  }
}

async function buildRules(type: 'subs' | 'news') {
  if (type === 'news') {
    return [maxCharsRule(54), numberStyleRule(), capitalizationRule()]
  }

  const properNouns = await loadProperNouns()
  return [
    ...defaultSegmentRules(),
    numberStyleRule(),
    punctuationRuleWithOptions({
      properNouns: properNouns ?? undefined,
    }),
  ]
}

const args = parseArgs(process.argv.slice(2))

if (!args.filePath) {
  printUsage()
  process.exit(1)
}

const text = await readFile(args.filePath, 'utf8')
const rules = await buildRules(args.type)
const metrics = analyzeTextByType(text, args.type, rules)

const output: Metric[] | ReturnType<typeof getFindings> = args.findingsOnly
  ? getFindings(metrics)
  : metrics

const filtered =
  args.ruleFilters.length === 0
    ? output
    : output.filter((metric) => args.ruleFilters.includes(metric.type))

console.log(JSON.stringify(filtered, null, 2))
