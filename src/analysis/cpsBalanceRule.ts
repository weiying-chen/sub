import type { Rule, CPSBalanceMetric, RuleCtx } from './types'

import { FPS } from '../shared/subtitles'
import {
  type LineSource,
  parseBlockAt,
  isContinuationOfPrevious,
  mergeForward,
} from '../shared/tsvRuns'
import type { Segment, SegmentCtx, SegmentRule } from './segments'

const DELTA_CPS = 5

type CpsBalanceRule = Rule & SegmentRule

function hasTiming(
  segment: Segment
): segment is Segment & { tsIndex: number; startFrames: number; endFrames: number } {
  return (
    typeof segment.tsIndex === 'number' &&
    typeof segment.startFrames === 'number' &&
    typeof segment.endFrames === 'number'
  )
}

function isSegmentContinuation(segments: Segment[], index: number): boolean {
  if (index <= 0) return false
  const cur = segments[index]
  const prev = segments[index - 1]
  if (!hasTiming(cur) || !hasTiming(prev)) return false
  return cur.text === prev.text
}

function mergeForwardSegments(segments: Segment[], startIndex: number) {
  const first = segments[startIndex]
  if (!hasTiming(first)) return null

  let endIndex = startIndex
  let endFrames = first.endFrames

  while (endIndex + 1 < segments.length) {
    const next = segments[endIndex + 1]
    if (!hasTiming(next) || next.text !== first.text) break
    endFrames = next.endFrames
    endIndex += 1
  }

  return {
    startIndex,
    endIndex,
    startFrames: first.startFrames,
    endFrames,
    text: first.text,
    tsIndex: first.tsIndex,
  }
}

export function cpsBalanceRule(): CpsBalanceRule {
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      const cur = ctx.segment
      if (!hasTiming(cur)) return []
      if (isSegmentContinuation(ctx.segments, ctx.segmentIndex)) return []

      const runA = mergeForwardSegments(ctx.segments, ctx.segmentIndex)
      if (!runA) return []

      const nextIndex = runA.endIndex + 1
      const next = ctx.segments[nextIndex]
      if (!next || !hasTiming(next)) return []

      const runB = mergeForwardSegments(ctx.segments, nextIndex)
      if (!runB) return []

      const durationA = runA.endFrames - runA.startFrames
      const durationB = runB.endFrames - runB.startFrames

      const cpsA =
        durationA === 0 ? Infinity : (runA.text.length * FPS) / durationA

      const cpsB =
        durationB === 0 ? Infinity : (runB.text.length * FPS) / durationB

      const deltaCps = Math.abs(cpsA - cpsB)

      if (deltaCps < DELTA_CPS) {
        return []
      }

      const faster =
        cpsA >= cpsB
          ? { run: runA, cps: cpsA, neighborCps: cpsB }
          : { run: runB, cps: cpsB, neighborCps: cpsA }

      const metric: CPSBalanceMetric = {
        type: 'CPS_BALANCE',
        lineIndex: faster.run.tsIndex,
        cps: faster.cps,
        neighborCps: faster.neighborCps,
        deltaCps,
        text: faster.run.text,
      }

      return [metric]
    }

    const src: LineSource = {
      lineCount: ctx.lines.length,
      getLine: (i) => ctx.lines[i] ?? '',
    }

    const cur = parseBlockAt(src, ctx.lineIndex)
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

    while (nextTsIndex < ctx.lines.length) {
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
      text: faster.run.payloadText,
    }

    return [metric]
  }) as CpsBalanceRule
}
