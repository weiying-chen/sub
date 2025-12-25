import chokidar from 'chokidar'
import { readFile } from 'node:fs/promises'

import { analyzeLines } from '../analysis/analyzeLines'
import { defaultRules } from '../analysis/defaultRules'
import { getFindings } from '../shared/findings'
import type { Finding } from '../analysis/types'

// --- ANSI colors (use terminal theme palette) ---

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const YELLOW = '\x1b[33m'

// Parse CLI args once
// Usage: watch <file> [--balance]
const args = process.argv.slice(2)
const filePath = args[0]
const includeBalance = args.includes('--balance')

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

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}

function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function formatFinding(f: Finding): string {
  const anyF: any = f

  // Anchor (shown once). Prefer lineIndex if present.
  const lineIndex =
    asNum(anyF.lineIndex) ??
    asNum(anyF.tsIndex) ??
    asNum(anyF.startTsIndex) ??
    asNum(anyF.index)

  const anchor = lineIndex != null ? `L${Math.trunc(lineIndex) + 1}` : 'L?'

  const type =
    (typeof anyF.type === 'string' && anyF.type) ||
    (typeof anyF.rule === 'string' && anyF.rule) ||
    'ISSUE'

  const parts: string[] = []
  const previewKeys = ['preview', 'text', 'payloadText', 'line', 'message']
  let previewText: string | null = null

  for (const [key, value] of Object.entries(anyF)) {
    if (key === 'type' || key === 'rule') continue
    if (key === 'lineIndex') continue // already covered by anchor
    if (value == null) continue

    // Collect subtitle-ish text, but print it later
    if (previewKeys.includes(key) && typeof value === 'string') {
      if (!previewText && value.trim() !== '') {
        previewText = value
      }
      continue
    }

    if (typeof value === 'number') {
      const asNumber = Number.isFinite(value)
        ? (value as number).toFixed(1)
        : String(value)

      // All numeric values in magenta + bold
      parts.push(`${key}: ${BOLD}${MAGENTA}${asNumber}${RESET}`)
      continue
    }

    if (typeof value === 'string') {
      parts.push(`${key}: ${value}`)
      continue
    }

    if (typeof value === 'boolean') {
      parts.push(`${key}: ${value}`)
      continue
    }

    try {
      parts.push(`${key}: ${JSON.stringify(value)}`)
    } catch {
      // ignore non-serializable stuff
    }
  }

  // Line number cyan+bold, type yellow, rest plain (except magenta numbers)
  const head = `${BOLD}${CYAN}${anchor}${RESET}  ${YELLOW}${type}${RESET}${
    parts.length ? `  ${parts.join('  ')}` : ''
  }`

  // Subtitle text on its own indented line, no extra color
  if (previewText) {
    return `${head}\n  text: ${previewText}`
  }

  return head
}

async function printReport(path: string) {
  const text = await readFile(path, 'utf8')

  const metrics = analyzeLines(text, defaultRules())
  const allFindings = getFindings(metrics) as Finding[]

  // Optional filter: hide CPS_BALANCE unless explicitly requested
  const findings = allFindings.filter((f: any) => {
    const t =
      (typeof f.type === 'string' && f.type) ||
      (typeof f.rule === 'string' && f.rule) ||
      ''
    if (!includeBalance && t === 'CPS_BALANCE') {
      return false
    }
    return true
  })

  clearScreen()

  if (findings.length === 0) {
    console.log('OK')
    return
  }

  console.log(
    `${findings.length} issues${
      includeBalance ? '' : '  (CPS_BALANCE hidden, use --balance to show)'
    }`
  )
  console.log('')

  // Stable ordering: by anchor if possible, then by type string.
  const sorted = [...findings].sort((a: any, b: any) => {
    const ai =
      asNum(a?.lineIndex) ?? asNum(a?.tsIndex) ?? asNum(a?.startTsIndex) ?? 1e12
    const bi =
      asNum(b?.lineIndex) ?? asNum(b?.tsIndex) ?? asNum(b?.startTsIndex) ?? 1e12
    if (ai !== bi) return ai - bi

    const at = typeof a?.type === 'string' ? a.type : ''
    const bt = typeof b?.type === 'string' ? b.type : ''
    return at.localeCompare(bt)
  })

  for (const f of sorted) {
    console.log(formatFinding(f))
  }
}

export async function watch(path: string) {
  // Lint once immediately
  try {
    await printReport(path)
  } catch (err) {
    clearScreen()
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`ERROR ${msg}`)
  }

  // Then watch and re-run on changes
  const run = debounce(async () => {
    try {
      await printReport(path)
    } catch (err) {
      clearScreen()
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ERROR ${msg}`)
    }
  }, 200)

  const watcher = chokidar.watch(path, {
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

  console.log(`watching ${path}${includeBalance ? ' (with CPS_BALANCE)' : ''}`)
}

// --- CLI entry ---

if (!filePath) {
  console.error('Usage: watch <file> [--balance]')
  process.exit(1)
}

void watch(filePath)
