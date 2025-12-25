import chokidar from 'chokidar'
import { readFile } from 'node:fs/promises'

import { analyzeLines } from '../analysis/analyzeLines'
import { defaultRules } from '../analysis/defaultRules'
import { getFindings } from '../shared/findings'
import type { Finding } from '../analysis/types'

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

  // Show everything inline, key: value, no alignment.
  // But keep the actual subtitle text at the very end.
  const parts: string[] = []
  const previewKeys = ['preview', 'text', 'payloadText', 'line', 'message']
  let previewText: string | null = null

  for (const [key, value] of Object.entries(anyF)) {
    if (key === 'type' || key === 'rule') continue
    if (key === 'lineIndex') continue // redundant with anchor
    if (value == null) continue

    // Capture text-ish fields but don't print them yet
    if (previewKeys.includes(key) && typeof value === 'string') {
      if (!previewText && value.trim() !== '') {
        previewText = value
      }
      continue
    }

    if (typeof value === 'number') {
      parts.push(
        `${key}: ${Number.isFinite(value) ? value.toFixed(1) : value}`
      )
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

    // Objects/arrays: one-line JSON, still key: value
    try {
      parts.push(`${key}: ${JSON.stringify(value)}`)
    } catch {
      // skip non-serializable stuff
    }
  }

  // Always put the main text at the very end if we found any
  if (previewText) {
    parts.push(`text: ${previewText}`)
  }

  return `${anchor}  ${type}${parts.length ? `  ${parts.join('  ')}` : ''}`
}

async function printReport(filePath: string) {
  const text = await readFile(filePath, 'utf8')

  const metrics = analyzeLines(text, defaultRules())
  const findings = getFindings(metrics) as Finding[]

  clearScreen()

  if (findings.length === 0) {
    console.log('OK')
    return
  }

  console.log(`${findings.length} issues`)
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

export async function watch(filePath: string) {
  const run = debounce(async () => {
    try {
      await printReport(filePath)
    } catch (err) {
      clearScreen()
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

  // Print once at start.
  console.log(`watching ${filePath}`)
}

// --- CLI entry ---

const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: watch <file>')
  process.exit(1)
}

void watch(filePath)
