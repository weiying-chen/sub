import chokidar from 'chokidar'
import { readFile } from 'node:fs/promises'

import { analyzeLines } from '../analysis/analyzeLines'
import { getFindings } from '../shared/findings'
import type { LineSource } from '../shared/tsvRuns'

function debounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  ms: number
) {
  let t: NodeJS.Timeout | null = null

  return (...args: TArgs) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      void fn(...args)
    }, ms)
  }
}

function asLineSource(text: string): LineSource {
  const lines = text.split(/\r?\n/)

  return {
    lineCount: lines.length,
    getLine(index: number) {
      return lines[index] ?? ''
    },
  }
}

async function printSummary(filePath: string) {
  const text = await readFile(filePath, 'utf8')

  const src = asLineSource(text)
  const metrics = analyzeLines(src)
  const findings = getFindings(metrics)

  if (findings.length === 0) {
    console.log('OK')
  } else {
    console.log(`${findings.length} issues`)
  }
}

export async function watch(filePath: string) {
  const run = debounce(async () => {
    try {
      await printSummary(filePath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ERROR ${msg}`)
    }
  }, 200)

  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 80,
      pollInterval: 20,
    },
  })

  watcher.on('change', run)
  watcher.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`WATCHER_ERROR ${msg}`)
  })

  console.log(`watching ${filePath}`)
}

// --- CLI entry ---

const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: watch <file>')
  process.exit(1)
}

void watch(filePath)
