import type { Rule, CPSFinding } from './types'

const FPS = 30
const MAX_CPS_DEFAULT = 17

const TIME_RE = /^(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2}):(?<f>\d{2})$/
const TSV_RE =
  /^(?<start>\d{2}:\d{2}:\d{2}:\d{2})\t+(?<end>\d{2}:\d{2}:\d{2}:\d{2})\t+.*$/

function parseTimecodeToFrames(tc: string): number | null {
  const m = tc.trim().match(TIME_RE)
  if (!m || !m.groups) return null

  const h = Number(m.groups.h)
  const mn = Number(m.groups.m)
  const s = Number(m.groups.s)
  const f = Number(m.groups.f)

  if (!Number.isFinite(h) || !Number.isFinite(mn) ||
      !Number.isFinite(s) || !Number.isFinite(f)) return null
  if (f < 0 || f >= FPS) return null

  return h * 108000 + mn * 1800 + s * 30 + f
}

function findNextNonEmptyLineIndex(
  lines: string[],
  fromIndexExclusive: number
): number | null {
  for (let i = fromIndexExclusive + 1; i < lines.length; i++) {
    if (lines[i]?.trim() !== '') return i
  }
  return null
}

type Block = {
  tsLineIndex: number
  englishLineIndex: number
  text: string
  startFrames: number
  endFrames: number
}

function parseBlockAt(lines: string[], tsLineIndex: number): Block | null {
  const tsLine = lines[tsLineIndex]
  if (!tsLine) return null

  const m = tsLine.match(TSV_RE)
  if (!m?.groups) return null

  const start = parseTimecodeToFrames(m.groups.start)
  const end = parseTimecodeToFrames(m.groups.end)
  if (start == null || end == null || end < start) return null

  const englishLineIndex =
    findNextNonEmptyLineIndex(lines, tsLineIndex)
  if (englishLineIndex == null) return null

  const text = lines[englishLineIndex]
  if (!text || text.trim() === '') return null

  return {
    tsLineIndex,
    englishLineIndex,
    text,
    startFrames: start,
    endFrames: end,
  }
}

export function cpsRule(
  maxCps: number = MAX_CPS_DEFAULT
): Rule {
  return ({ lineIndex, lines }) => {
    const cur = parseBlockAt(lines, lineIndex)
    if (!cur) return []

    // skip if continuation of identical previous block
    for (let i = cur.tsLineIndex - 1; i >= 0; i--) {
      const prev = parseBlockAt(lines, i)
      if (!prev) continue
      if (
        prev.text === cur.text &&
        prev.endFrames === cur.startFrames
      ) return []
      break
    }

    // merge forward
    let mergedStart = cur.startFrames
    let mergedEnd = cur.endFrames
    let scan = cur.tsLineIndex

    while (true) {
      let nextTs: number | null = null
      for (let j = scan + 1; j < lines.length; j++) {
        if (TSV_RE.test(lines[j] ?? '')) {
          nextTs = j
          break
        }
      }
      if (nextTs == null) break

      const next = parseBlockAt(lines, nextTs)
      if (
        next &&
        next.text === cur.text &&
        next.startFrames === mergedEnd
      ) {
        mergedEnd = next.endFrames
        scan = next.tsLineIndex
        continue
      }
      break
    }

    const durationFrames = mergedEnd - mergedStart
    const charCount = cur.text.length
    const cps =
      durationFrames === 0
        ? Infinity
        : (charCount * FPS) / durationFrames

    const v: CPSFinding = {
      type: 'CPS',
      lineIndex: cur.englishLineIndex,
      text: cur.text,
      cps,
      maxCps,
      durationFrames,
      charCount,
    }

    return [v]
  }
}
