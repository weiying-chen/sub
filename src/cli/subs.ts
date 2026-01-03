import { readFile } from 'node:fs/promises'

import { analyzeTextByType } from '../analysis/analyzeTextByType'
import { baselineRule } from '../analysis/baselineRule'
import { defaultSegmentRules } from '../analysis/defaultRules'
import { numberStyleRule } from '../analysis/numberStyleRule'
import { punctuationRule } from '../analysis/punctuationRule'
import { getFindings } from '../shared/findings'
import type { Finding } from '../analysis/types'
import type { Reporter } from './watch'
import { findMarkerScope } from './markerScope'

// --- ANSI colors (use terminal theme palette) ---

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const YELLOW = '\x1b[33m'

type SubsOptions = {
  includeBalance: boolean
  baselinePath?: string
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

  if (type === 'PUNCTUATION') {
    const lines: string[] = []
    const detail =
      typeof anyF.detail === 'string' && anyF.detail
        ? anyF.detail
        : 'Punctuation check failed'
    const currText =
      typeof anyF.text === 'string' && anyF.text.trim() !== ''
        ? anyF.text
        : null
    const currTs =
      typeof anyF.timestamp === 'string' && anyF.timestamp
        ? ` (${anyF.timestamp})`
        : ''

    if (currText) {
      lines.push(`${BOLD}${CYAN}${anchor}${RESET}  ${currText}`)
      lines.push(`${YELLOW}${type}${RESET}  detail: ${detail}`)
    } else {
      const head = `${BOLD}${CYAN}${anchor}${RESET}  ${YELLOW}${type}${RESET}  ${detail}`
      lines.push(head)
    }

    if (typeof anyF.prevText === 'string' && anyF.prevText.trim() !== '') {
      const prevTs =
        typeof anyF.prevTimestamp === 'string' && anyF.prevTimestamp
          ? ` (${anyF.prevTimestamp})`
          : ''
      lines.push(`PREV${prevTs}: ${anyF.prevText}`)
    }

    if (currText) {
      lines.push(`CURR${currTs}: ${currText}`)
    }

    if (typeof anyF.nextText === 'string' && anyF.nextText.trim() !== '') {
      const nextTs =
        typeof anyF.nextTimestamp === 'string' && anyF.nextTimestamp
          ? ` (${anyF.nextTimestamp})`
          : ''
      lines.push(`NEXT${nextTs}: ${anyF.nextText}`)
    }

    return lines.join('\n')
  }

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

  if (type === 'BASELINE') {
    const baselineLineIndex = asNum(anyF.baselineLineIndex)
    const baselineParts: string[] = []
    if (typeof anyF.reason === 'string' && anyF.reason) {
      baselineParts.push(`reason: ${anyF.reason.replace(/_/g, ' ')}`)
    }
    if (baselineLineIndex != null) {
      const baselineAnchor = `L${Math.trunc(baselineLineIndex) + 1}`
      if (baselineAnchor !== anchor) {
        baselineParts.push(`current: ${anchor}`)
      }
      if (anyF.reason !== 'missing' && baselineAnchor !== anchor) {
        baselineParts.push(`baselineLine: ${baselineAnchor}`)
      }
    }
    if (typeof anyF.expected === 'string' && anyF.reason !== 'missing') {
      baselineParts.push(`expected: ${anyF.expected}`)
    }
    if (typeof anyF.actual === 'string') {
      baselineParts.push(`actual: ${anyF.actual}`)
    }

    const head = `${YELLOW}${type}${RESET}${
      baselineParts.length ? `  ${baselineParts.join('  ')}` : ''
    }`

    const lines: string[] = []
    if (typeof anyF.timestamp === 'string') {
      lines.push(`${BOLD}${CYAN}${anchor}${RESET}  ${anyF.timestamp}`)
    }
    lines.push(head)
    if (tokenText) lines.push(`token: ${tokenText}`)

    return lines.join('\n')
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

async function printReport(
  path: string,
  options: SubsOptions,
  clearScreen: () => void
) {
  const text = await readFile(path, 'utf8')
  const lines = text.split('\n')
  const baselineText = options.baselinePath
    ? await readFile(options.baselinePath, 'utf8')
    : null

  const rules = [
    ...defaultSegmentRules(),
    numberStyleRule(),
    punctuationRule(),
  ]
  if (baselineText != null) {
    rules.push(baselineRule(baselineText))
  }

  const metrics = analyzeTextByType(text, 'subs', rules)
  const scope = findMarkerScope(lines)
  const scopedMetrics = scope
    ? metrics.filter(
        (m) => m.lineIndex >= scope.start && m.lineIndex <= scope.end
      )
    : metrics
  const allFindings = getFindings(scopedMetrics) as Finding[]

  // Optional filter: hide CPS_BALANCE unless explicitly requested
  const findings = allFindings.filter((f: any) => {
    const t =
      (typeof f.type === 'string' && f.type) ||
      (typeof f.rule === 'string' && f.rule) ||
      ''
    if (!options.includeBalance && t === 'CPS_BALANCE') {
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
      options.includeBalance
        ? ''
        : '  (CPS_BALANCE hidden, use --balance to show)'
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

  const baselineFindings = sorted.filter(
    (f: any) => typeof f?.type === 'string' && f.type === 'BASELINE'
  )
  const otherFindings = sorted.filter((f) => !baselineFindings.includes(f))

  if (baselineFindings.length > 0) {
    console.log('[Integrity]')
    console.log('')
    baselineFindings.forEach((f, index) => {
      console.log(formatFinding(f))
      if (index < baselineFindings.length - 1) {
        console.log('')
      }
    })
    if (otherFindings.length > 0) console.log('')
  }

  if (otherFindings.length > 0) {
    console.log('[Subtitle checks]')
    console.log('')
    otherFindings.forEach((f, index) => {
      console.log(formatFinding(f))
      if (index < otherFindings.length - 1) {
        console.log('')
      }
    })
  }
}

export function createSubsReporter(options: SubsOptions): Reporter {
  return async (path, { clearScreen }) => {
    await printReport(path, options, clearScreen)
  }
}
