import type { Rule, CPSBalanceMetric } from './types'

import { FPS } from '../shared/subtitles'
import {
  type LineSource,
  parseBlockAt,
  isContinuationOfPrevious,
  mergeForward,
} from '../shared/tsvRuns'

const DELTA_CPS = 5

export function cpsBalanceRule(): Rule {
  return ({ lineIndex, lines }) => {
    const src: LineSource = {
      lineCount: lines.length,
      getLine: (i) => lines[i] ?? '',
    }

    const cur = parseBlockAt(src, lineIndex)
    if (!cur) {
      return []
    }

    if (isContinuationOfPrevious(src, cur)) {
      return []
    }

    const runA = mergeForward(src, cur)

    // ---- FIX: scan forward to find the next timestamp block ----
    let nextTsIndex = runA.endTsIndex + 1
    let next = null

    while (nextTsIndex < lines.length) {
      next = parseBlockAt(src, nextTsIndex)
      if (next) break
      nextTsIndex++
    }

    if (!next) {
      return []
    }

    const runB = mergeForward(src, next)

    // ---- CPS computation ----
    const durationA = runA.endFrames - runA.startFrames
    const durationB = runB.endFrames - runB.startFrames

    const cpsA =
      durationA === 0
        ? Infinity
        : (runA.payloadText.length * FPS) / durationA

    const cpsB =
      durationB === 0
        ? Infinity
        : (runB.payloadText.length * FPS) / durationB

    const deltaCps = Math.abs(cpsA - cpsB)

    if (deltaCps < DELTA_CPS) {
      return []
    }

    // Warn on the faster run
    const faster =
      cpsA >= cpsB
        ? { run: runA, cps: cpsA, neighborCps: cpsB }
        : { run: runB, cps: cpsB, neighborCps: cpsA }

    const metric: CPSBalanceMetric = {
      type: 'CPS_BALANCE',
      lineIndex: faster.run.startTsIndex,
      cps: faster.cps,
      neighborCps: faster.neighborCps,
      deltaCps,
    }

    return [metric]
  }
}
