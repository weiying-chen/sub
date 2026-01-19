import type { Rule, CPSBalanceMetric, RuleCtx } from './types'

import { FPS } from '../shared/subtitles'
import {
  type LineSource,
  type ParseBlockOptions,
  hasEmptyLineBetween,
  parseBlockAt,
  isContinuationOfPrevious,
  mergeForward,
} from '../shared/tsvRuns'
import type { Segment, SegmentCtx, SegmentRule } from './segments'

const DELTA_CPS = 5

type CpsBalanceRule = Rule & SegmentRule
type CpsBalanceRuleOptions = ParseBlockOptions

function hasTiming(
  segment: Segment
): segment is Segment & { tsIndex: number; startFrames: number; endFrames: number } {
  return (
    typeof segment.tsIndex === 'number' &&
    typeof segment.startFrames === 'number' &&
    typeof segment.endFrames === 'number'
  )
}

function hasSegmentGap(
  lines: string[] | undefined,
  prev: Segment,
  cur: Segment,
  ignoreEmptyLines: boolean
): boolean {
  if (ignoreEmptyLines || !lines) return false
  if (typeof prev.payloadIndex !== 'number' || typeof cur.tsIndex !== 'number') {
    return false
  }
  const src: LineSource = {
    lineCount: lines.length,
    getLine: (i) => lines[i] ?? '',
  }
  return hasEmptyLineBetween(src, prev.payloadIndex, cur.tsIndex)
}

function isSegmentContinuation(
  segments: Segment[],
  index: number,
  lines: string[] | undefined,
  ignoreEmptyLines: boolean
): boolean {
  if (index <= 0) return false
  const cur = segments[index]
  const prev = segments[index - 1]
  if (!hasTiming(cur) || !hasTiming(prev)) return false
  if (hasSegmentGap(lines, prev, cur, ignoreEmptyLines)) return false
  return cur.text === prev.text
}

function mergeForwardSegments(
  segments: Segment[],
  startIndex: number,
  lines: string[] | undefined,
  ignoreEmptyLines: boolean
) {
  const first = segments[startIndex]
  if (!hasTiming(first)) return null

  let endIndex = startIndex
  let endFrames = first.endFrames

  while (endIndex + 1 < segments.length) {
    const next = segments[endIndex + 1]
    if (!hasTiming(next) || next.text !== first.text) break
    if (hasSegmentGap(lines, segments[endIndex], next, ignoreEmptyLines)) break
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

export function cpsBalanceRule(
  options: CpsBalanceRuleOptions = {}
): CpsBalanceRule {
  const ignoreEmptyLines = options.ignoreEmptyLines ?? false
  return ((ctx: RuleCtx | SegmentCtx) => {
    if ('segment' in ctx) {
      const cur = ctx.segment
      if (!hasTiming(cur)) return []
      if (
        isSegmentContinuation(
          ctx.segments,
          ctx.segmentIndex,
          ctx.lines,
          ignoreEmptyLines
        )
      ) {
        return []
      }

      const runA = mergeForwardSegments(
        ctx.segments,
        ctx.segmentIndex,
        ctx.lines,
        ignoreEmptyLines
      )
      if (!runA) return []

      const nextIndex = runA.endIndex + 1
      const next = ctx.segments[nextIndex]
      if (!next || !hasTiming(next)) return []

      const runB = mergeForwardSegments(
        ctx.segments,
        nextIndex,
        ctx.lines,
        ignoreEmptyLines
      )
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
        severity: 'warn',
      }

      return [metric]
    }

    const src: LineSource = {
      lineCount: ctx.lines.length,
      getLine: (i) => ctx.lines[i] ?? '',
    }

    const cur = parseBlockAt(src, ctx.lineIndex, options)
    if (!cur) {
      return []
    }

    if (isContinuationOfPrevious(src, cur, options)) {
      return []
    }

    const runA = mergeForward(src, cur, options)

    // ---- FIX: scan forward to find the next timestamp block ----
    let nextTsIndex = runA.endTsIndex + 1
    let next = null

    while (nextTsIndex < ctx.lines.length) {
      next = parseBlockAt(src, nextTsIndex, options)
      if (next) break
      nextTsIndex++
    }

    if (!next) {
      return []
    }

    const runB = mergeForward(src, next, options)

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
      severity: 'warn',
    }

    return [metric]
  }) as CpsBalanceRule
}
