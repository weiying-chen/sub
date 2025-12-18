import type { Rule, CPSMetric } from './types'

import { FPS, MAX_CPS, TSV_RE, parseTimecodeToFrames } from '../shared/subtitles'

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
  payloadIndex: number
  payloadText: string
  startFrames: number
  endFrames: number
}

function parseBlockAt(lines: string[], tsLineIndex: number): Block | null {
  const tsLine = lines[tsLineIndex]
  if (!tsLine) return null

  const m = tsLine.match(TSV_RE)
  if (!m?.groups) return null

  const startFrames = parseTimecodeToFrames(m.groups.start)
  const endFrames = parseTimecodeToFrames(m.groups.end)
  if (startFrames == null || endFrames == null || endFrames < startFrames) {
    return null
  }

  const payloadIndex = findNextNonEmptyLineIndex(lines, tsLineIndex)
  if (payloadIndex == null) return null

  const payloadText = lines[payloadIndex]
  if (!payloadText || payloadText.trim() === '') return null

  return {
    tsLineIndex,
    payloadIndex,
    payloadText,
    startFrames,
    endFrames,
  }
}

export function cpsRule(maxCps: number = MAX_CPS): Rule {
  return ({ lineIndex, lines }) => {
    const cur = parseBlockAt(lines, lineIndex)
    if (!cur) return []

    // Skip if this timestamp block is a continuation of an identical contiguous block.
    // (Only the first block in the run should emit a metric.)
    for (let i = cur.tsLineIndex - 1; i >= 0; i--) {
      const prev = parseBlockAt(lines, i)
      if (!prev) continue

      const isContinuation =
        prev.payloadText === cur.payloadText &&
        prev.endFrames === cur.startFrames

      if (isContinuation) return []

      break
    }

    // Merge forward: exact same payload + contiguous timing.
    const mergedStart = cur.startFrames
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
        next.payloadText === cur.payloadText &&
        next.startFrames === mergedEnd
      ) {
        mergedEnd = next.endFrames
        scan = next.tsLineIndex
        continue
      }

      break
    }

    const durationFrames = mergedEnd - mergedStart
    const charCount = cur.payloadText.length
    const cps =
      durationFrames === 0 ? Infinity : (charCount * FPS) / durationFrames

    const metric: CPSMetric = {
      type: 'CPS',
      lineIndex: cur.tsLineIndex, // anchor to the timestamp line
      text: cur.payloadText,
      cps,
      maxCps,
      durationFrames,
      charCount,
    }

    return [metric]
  }
}
