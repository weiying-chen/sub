import { readFile } from 'node:fs/promises'

import type { Finding } from '../analysis/types'
import { formatCliNumber } from './numberFormat'
import type { Reporter } from './watch'
import { buildAnalyzeOutput } from './analyzeOutput'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const YELLOW = '\x1b[33m'

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
  const previewKeys = ['text', 'payloadText', 'line', 'message']
  const tokenKeys = ['token']
  let lineText: string | null = null
  let tokenText: string | null = null

  for (const [key, value] of Object.entries(anyF)) {
    if (key === 'type' || key === 'rule') continue
    if (key === 'lineIndex') continue // already covered by anchor
    if (value == null) continue

    // Collect subtitle-ish text, but print it later
    if (previewKeys.includes(key) && typeof value === 'string') {
      if (!lineText && value.trim() !== '') {
        lineText = value
      }
      continue
    }

    if (tokenKeys.includes(key) && typeof value === 'string') {
      if (!tokenText && value.trim() !== '') {
        tokenText = value
      }
      continue
    }

    if (typeof value === 'number') {
      const asNumber = formatCliNumber(key, value)

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
  const headNoAnchor = `${YELLOW}${type}${RESET}${
    parts.length ? `  ${parts.join('  ')}` : ''
  }`

  // Subtitle text on its own indented line, no extra color
  if (lineText) {
    const lines = [
      `${BOLD}${CYAN}${anchor}${RESET}  ${lineText}`,
      headNoAnchor,
    ]
    if (tokenText) lines.push(`  token: ${tokenText}`)
    return lines.join('\n')
  }

  if (tokenText) {
    return `${head}\n  token: ${tokenText}`
  }

  return head
}

export function createNewsReporter(options: NewsOptions): Reporter {
  return async (path, { clearScreen }) => {
    const text = await readFile(path, 'utf8')
    const findings = (await buildAnalyzeOutput(text, {
      type: 'news',
      mode: 'findings',
      includeWarnings: options.includeWarnings,
    })) as Finding[]

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

    console.log('[News checks]')
    console.log('')
    sorted.forEach((f, index) => {
      console.log(formatFinding(f))
      if (index < sorted.length - 1) {
        console.log('')
      }
    })
  }
}
type NewsOptions = {
  includeWarnings: boolean
}
