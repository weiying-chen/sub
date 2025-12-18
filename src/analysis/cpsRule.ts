import type { Rule, CPSMetric } from './types'

import { FPS, MAX_CPS } from '../shared/subtitles'
import {
  type LineSource,
  parseBlockAt,
  isContinuationOfPrevious,
  mergeForward,
} from '../shared/tsvRuns'

export function cpsRule(maxCps: number = MAX_CPS): Rule {
  return ({ lineIndex, lines }) => {
    const src: LineSource = {
      lineCount: lines.length,
      getLine: (i) => lines[i] ?? '',
    }

    const cur = parseBlockAt(src, lineIndex)
    if (!cur) return []

    // Skip if this timestamp block is a continuation of an identical contiguous block.
    // (Only the first block in the run should emit a metric.)
    if (isContinuationOfPrevious(src, cur)) return []

    // Merge forward: exact same payload + contiguous timing.
    const run = mergeForward(src, cur)

    const durationFrames = run.endFrames - run.startFrames
    const charCount = run.payloadText.length
    const cps =
      durationFrames === 0 ? Infinity : (charCount * FPS) / durationFrames

    const metric: CPSMetric = {
      type: 'CPS',
      lineIndex: cur.tsIndex, // anchor to the timestamp line
      text: run.payloadText,
      cps,
      maxCps,
      durationFrames,
      charCount,
    }

    return [metric]
  }
}
