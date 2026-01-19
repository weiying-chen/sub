import type { Rule, CPSMetric, RuleCtx } from './types'

import { FPS, MAX_CPS, MIN_CPS } from '../shared/subtitles'
import {
  type LineSource,
  type ParseBlockOptions,
  hasEmptyLineBetween,
  parseBlockAt,
  isContinuationOfPrevious,
  mergeForward,
} from '../shared/tsvRuns'
import type { Segment, SegmentCtx, SegmentRule } from './segments'

type CpsRule = Rule & SegmentRule
type CpsRuleOptions = ParseBlockOptions

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

export function cpsRule(
  maxCps: number = MAX_CPS,
  minCps: number = MIN_CPS,
  options: CpsRuleOptions = {}
): CpsRule {
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

      const run = mergeForwardSegments(
        ctx.segments,
        ctx.segmentIndex,
        ctx.lines,
        ignoreEmptyLines
      )
      if (!run) return []

      const durationFrames = run.endFrames - run.startFrames
      const charCount = run.text.length
      const cps =
        durationFrames === 0 ? Infinity : (charCount * FPS) / durationFrames

      const metric: CPSMetric = {
        type: 'CPS',
        lineIndex: run.tsIndex,
        text: run.text,
        cps,
        maxCps,
        minCps,
        durationFrames,
        charCount,
      }

      return [metric]
    }

    const src: LineSource = {
      lineCount: ctx.lines.length,
      getLine: (i) => ctx.lines[i] ?? '',
    }

    const cur = parseBlockAt(src, ctx.lineIndex, options)
    if (!cur) return []

    // Skip if this timestamp block is a continuation of a previous identical payload.
    // (Only the first block in the merged run should emit a metric.)
    if (isContinuationOfPrevious(src, cur, options)) return []

    // Merge forward: exact same payload (timing gaps allowed).
    const run = mergeForward(src, cur, options)

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
      minCps,
      durationFrames,
      charCount,
    }

    return [metric]
  }) as CpsRule
}
